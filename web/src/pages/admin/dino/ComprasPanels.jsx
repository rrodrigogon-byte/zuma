// Compras e estoque da revenda: fornecedores, pedidos de compra com recebimento,
// entrada por XML de NF-e (prévia antes de lançar), sugestão de reposição e curva ABC.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../../hooks/useToast'
import { api, fmtR } from '../../../lib/api'

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }
const h2 = { margin: 0, fontSize: 20, fontFamily: 'var(--font-display)' }
const h3 = { margin: 0, fontSize: 16 }
const sub = { margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }
const td = { padding: '9px 10px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
const btn = { padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }
const btnPrimary = { ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit', fontSize: 13, minWidth: 0 }
const kpi = { background: 'var(--card2, var(--card))', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }
const kpiLabel = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }
const kpiValue = { fontSize: 24, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const empty = { padding: 22, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }
const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12 })
const moeda = (v) => fmtR ? fmtR(Number(v || 0)) : `R$ ${Number(v || 0).toFixed(2)}`
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')
const tons = { bom: '#14b87a', alerta: '#f59e0b', critico: '#e05c5c', neutro: 'var(--muted)' }
function Pill({ children, tom = 'neutro' }) {
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: tons[tom], border: `1px solid ${tons[tom]}`, whiteSpace: 'nowrap' }}>{children}</span>
}
function Aviso({ texto, tom = 'critico' }) {
  return texto ? <div role="alert" style={{ color: tons[tom], fontSize: 13 }}>{texto}</div> : null
}

const STATUS_PEDIDO = { rascunho: ['Rascunho', 'neutro'], enviado: ['Enviado', 'alerta'], recebido_parcial: ['Recebido em parte', 'alerta'], recebido: ['Recebido', 'bom'], cancelado: ['Cancelado', 'neutro'] }
const MOTIVO = { ruptura: ['Sem estoque', 'critico'], abaixo_do_minimo: ['Abaixo do mínimo', 'alerta'], acaba_antes_do_recebimento: ['Acaba antes de chegar', 'alerta'] }

function useLista(rota) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    setErro('')
    try { setDados(await api.get(rota)) } catch (e) { setErro(e.message || 'Não foi possível carregar.') }
  }, [rota])
  useEffect(() => { carregar() }, [carregar])
  return { dados, erro, carregar }
}

// ── Fornecedores ───────────────────────────────────────────────────────────
function Fornecedores({ fornecedores, onSalvo }) {
  const vazio = { nome: '', cnpj: '', contato: '', telefone: '', email: '', prazoEntregaDias: 7, condicaoPagamento: '' }
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState('')
  const [erro, setErro] = useState('')
  async function salvar(ev) {
    ev.preventDefault(); setErro('')
    try {
      if (editando) await api.put(`/api/admin/barbearia/compras/fornecedores/${editando}`, form)
      else await api.post('/api/admin/barbearia/compras/fornecedores', form)
      setForm(vazio); setEditando(''); onSalvo?.()
    } catch (e) { setErro(e.message) }
  }
  const campo = (k, ph, extra = {}) => <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{ph}<input aria-label={ph} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={input} {...extra} /></label>
  return <div style={card}>
    <h3 style={h3}>Fornecedores</h3>
    <p style={sub}>O prazo de entrega entra no cálculo da reposição. O fornecedor da NF-e é cadastrado sozinho na primeira nota.</p>
    <form onSubmit={salvar} style={{ ...grid(150), marginTop: 12 }}>
      {campo('nome', 'Nome *', { required: true })}{campo('cnpj', 'CNPJ', { inputMode: 'numeric' })}{campo('contato', 'Contato')}{campo('telefone', 'Telefone')}{campo('email', 'E-mail')}
      {campo('prazoEntregaDias', 'Prazo de entrega (dias)', { type: 'number', min: 0 })}{campo('condicaoPagamento', 'Condição de pagamento')}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}><button type="submit" style={btnPrimary}>{editando ? 'Salvar' : 'Cadastrar'}</button>{editando && <button type="button" style={btn} onClick={() => { setForm(vazio); setEditando('') }}>Cancelar</button>}</div>
    </form>
    <Aviso texto={erro} />
    <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={table}><thead><tr>{['Fornecedor', 'CNPJ', 'Contato', 'Prazo', ''].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{fornecedores.length === 0 ? <tr><td colSpan={5} style={empty}>Nenhum fornecedor ainda.</td></tr> : fornecedores.map((f) => <tr key={f.id}><td style={td}><strong>{f.nome}</strong></td><td style={td}>{f.cnpj || '—'}</td><td style={td}>{[f.contato, f.telefone, f.email].filter(Boolean).join(' · ') || '—'}</td><td style={td}>{f.prazoEntregaDias} dia(s)</td><td style={td}><button type="button" style={btn} onClick={() => { setEditando(f.id); setForm({ ...vazio, ...f }) }}>Editar</button></td></tr>)}</tbody></table></div>
  </div>
}

// ── NF-e de entrada ────────────────────────────────────────────────────────
function NotaEntrada({ produtos, pedidosAbertos, onLancada }) {
  const [xml, setXml] = useState('')
  const [arquivo, setArquivo] = useState('')
  const [previa, setPrevia] = useState(null)
  const [decisoes, setDecisoes] = useState({})
  const [pedidoId, setPedidoId] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function lerArquivo(ev) {
    const f = ev.target.files?.[0]
    if (!f) return
    setErro(''); setResultado(null); setPrevia(null); setArquivo(f.name)
    const texto = await f.text()
    setXml(texto)
    setOcupado(true)
    try {
      const r = await api.post('/api/admin/barbearia/compras/nfe/previa', { xml: texto })
      setPrevia(r)
      setDecisoes(Object.fromEntries(r.itens.map((i) => [i.item, { produtoId: i.produtoId || '', ignorar: false, criarProduto: !i.produtoId, precoVenda: '', fatorConversao: 1 }])))
    } catch (e) { setErro(e.message) } finally { setOcupado(false); ev.target.value = '' }
  }
  const mudar = (item, campo, valor) => setDecisoes((d) => ({ ...d, [item]: { ...d[item], [campo]: valor } }))
  async function lancar() {
    setErro(''); setOcupado(true)
    try {
      const itens = previa.itens.map((i) => {
        const d = decisoes[i.item] || {}
        if (d.ignorar) return { item: i.item, ignorar: true }
        if (d.produtoId) return { item: i.item, produtoId: d.produtoId, fatorConversao: Number(d.fatorConversao) || 1 }
        return { item: i.item, criarProduto: true, precoVenda: Number(String(d.precoVenda).replace(',', '.')) || 0, fatorConversao: Number(d.fatorConversao) || 1 }
      })
      const r = await api.post('/api/admin/barbearia/compras/nfe/lancar', { xml, itens, pedidoId: pedidoId || undefined, confirmado: true })
      setResultado(r.nota); setPrevia(null); setXml(''); onLancada?.()
    } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }
  return <div style={card}>
    <h3 style={h3}>Entrada por XML da NF-e</h3>
    <p style={sub}>Envie o XML da nota do fornecedor. O sistema confere cada item pelo código de barras, pelo código do fornecedor e pelo nome; você revisa antes de lançar. A mesma nota nunca entra duas vezes e o custo médio é recalculado.</p>
    <label style={{ ...btnPrimary, display: 'inline-flex', marginTop: 12, alignItems: 'center', gap: 6 }}>
      {ocupado ? 'Lendo…' : 'Escolher XML da NF-e'}
      <input type="file" accept=".xml,text/xml,application/xml" onChange={lerArquivo} style={{ display: 'none' }} />
    </label>
    <button type="button" style={{ ...btn, display: 'inline-flex', marginTop: 12, marginLeft: 10, alignItems: 'center', gap: 6 }} onClick={handleImportNF}>Importar NF Automática (IA)</button>
    <button type="button" style={{ ...btn, display: 'inline-flex', marginTop: 12, marginLeft: 10, alignItems: 'center', gap: 6 }} onClick={handleSefazSync}>Sincronizar com SEFAZ</button>
    {arquivo && <span style={{ ...sub, marginLeft: 10 }}>{arquivo}</span>}
    <Aviso texto={erro} />
    {resultado && <div style={{ marginTop: 12, color: tons.bom, fontSize: 13 }}><strong>NF-e {resultado.numero} lançada.</strong> {resultado.entradas.length} item(ns) no estoque{resultado.ignorados.length ? `, ${resultado.ignorados.length} ignorado(s)` : ''}{resultado.repetida ? ' (já tinha sido lançada antes)' : ''}.</div>}
    {previa && <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
      <div style={grid(170)}>
        <div style={kpi}><div style={kpiLabel}>Fornecedor</div><div style={{ fontWeight: 800, marginTop: 6 }}>{previa.nota.emitente.fantasia || previa.nota.emitente.nome}</div><div style={sub}>{previa.fornecedor ? 'Já cadastrado' : 'Será cadastrado'}</div></div>
        <div style={kpi}><div style={kpiLabel}>NF-e</div><div style={{ fontWeight: 800, marginTop: 6 }}>{previa.nota.numero}/{previa.nota.serie}</div><div style={sub}>{dataBR(previa.nota.emissao)} · {previa.nota.autorizada ? 'autorizada' : 'sem protocolo'}</div></div>
        <div style={kpi}><div style={kpiLabel}>Valor da nota</div><div style={kpiValue}>{moeda(previa.nota.valorNota)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Itens</div><div style={kpiValue}>{previa.resumo.comProduto}/{previa.resumo.itens}</div><div style={sub}>com produto encontrado</div></div>
      </div>
      {previa.jaLancada && <Aviso tom="alerta" texto={`Esta nota já foi lançada em ${dataBR(previa.lancadaEm)}. Lançar de novo não muda o estoque.`} />}
      <div style={{ overflowX: 'auto' }}><table style={{ ...table, minWidth: 900 }}><thead><tr>{['#', 'Item da nota', 'Qtd', 'Custo un.', 'Produto no estoque', 'Conversão', 'Ação'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{previa.itens.map((i) => { const d = decisoes[i.item] || {}; return <tr key={i.item} style={{ opacity: d.ignorar ? 0.5 : 1 }}>
          <td style={td}>{i.item}</td>
          <td style={td}><strong>{i.descricao}</strong><div style={sub}>{i.codigo}{i.ean ? ` · EAN ${i.ean}` : ''}{i.criterio && i.criterio !== 'sem_correspondencia' ? ` · casado por ${i.criterio.replace('_', ' ')}` : ''}</div></td>
          <td style={td}>{i.quantidade} {i.unidade}</td>
          <td style={td}>{moeda(i.custoUnitario)}</td>
          <td style={td}><select aria-label={`Produto do item ${i.item}`} value={d.produtoId || ''} onChange={(e) => mudar(i.item, 'produtoId', e.target.value)} style={{ ...input, width: 220 }} disabled={d.ignorar}><option value="">+ Criar produto novo</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} (estoque {p.estoqueAtual})</option>)}</select>
            {!d.produtoId && !d.ignorar && <input aria-label="Preço de venda do produto novo" placeholder="Preço de venda (R$)" inputMode="decimal" value={d.precoVenda} onChange={(e) => mudar(i.item, 'precoVenda', e.target.value)} style={{ ...input, width: 220, marginTop: 6 }} />}</td>
          <td style={td}><input aria-label="Unidades por item da nota" type="number" min="1" value={d.fatorConversao} onChange={(e) => mudar(i.item, 'fatorConversao', e.target.value)} style={{ ...input, width: 70 }} disabled={d.ignorar} /><div style={sub}>un. por item</div></td>
          <td style={td}><label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={Boolean(d.ignorar)} onChange={(e) => mudar(i.item, 'ignorar', e.target.checked)} />Ignorar</label></td>
        </tr> })}</tbody></table></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {pedidosAbertos.length > 0 && <select aria-label="Baixar pedido de compra" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} style={input}><option value="">Sem pedido vinculado</option>{pedidosAbertos.map((p) => <option key={p.id} value={p.id}>Baixar {p.numero} · {p.fornecedorNome}</option>)}</select>}
        <button type="button" style={btnPrimary} disabled={ocupado} onClick={lancar}>{ocupado ? 'Lançando…' : 'Confirmar entrada no estoque'}</button>
        <button type="button" style={btn} onClick={() => { setPrevia(null); setXml('') }}>Descartar</button>
      </div>
    </div>}
  </div>
}

// ── Pedidos de compra ──────────────────────────────────────────────────────
function NovoPedido({ fornecedores, produtos, onCriado }) {
  const [fornecedorId, setFornecedorId] = useState('')
  const [linhas, setLinhas] = useState([{ produtoId: '', quantidade: 1, custoUnitario: '' }])
  const [erro, setErro] = useState('')
  async function criar(ev) {
    ev.preventDefault(); setErro('')
    try {
      await api.post('/api/admin/barbearia/compras/pedidos', { fornecedorId, itens: linhas.filter((l) => l.produtoId).map((l) => ({ produtoId: l.produtoId, quantidade: Number(l.quantidade), custoUnitario: l.custoUnitario === '' ? undefined : Number(String(l.custoUnitario).replace(',', '.')) })) })
      setLinhas([{ produtoId: '', quantidade: 1, custoUnitario: '' }]); onCriado?.()
    } catch (e) { setErro(e.message) }
  }
  return <form onSubmit={criar} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
    <select aria-label="Fornecedor do pedido" required value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} style={input}><option value="">Fornecedor…</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
    {linhas.map((l, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 120px auto', gap: 8 }}>
      <select aria-label="Produto" value={l.produtoId} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, produtoId: e.target.value } : x)))} style={input}><option value="">Produto…</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
      <input aria-label="Quantidade" type="number" min="1" value={l.quantidade} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, quantidade: e.target.value } : x)))} style={input} />
      <input aria-label="Custo unitário" placeholder="Custo un." inputMode="decimal" value={l.custoUnitario} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, custoUnitario: e.target.value } : x)))} style={input} />
      <button type="button" style={btn} onClick={() => setLinhas(linhas.length > 1 ? linhas.filter((_, j) => j !== i) : linhas)} aria-label="Remover linha">×</button>
    </div>)}
    <div style={{ display: 'flex', gap: 8 }}><button type="button" style={btn} onClick={() => setLinhas([...linhas, { produtoId: '', quantidade: 1, custoUnitario: '' }])}>+ Item</button><button type="submit" style={btnPrimary}>Criar pedido (rascunho)</button></div>
    <Aviso texto={erro} />
  </form>
}

function Pedidos({ pedidos, fornecedores, produtos, onMudou }) {
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)
  async function acao(p, nome, corpo = {}) {
    setErro('')
    try { await api.post(`/api/admin/barbearia/compras/pedidos/${p.id}/${nome}`, corpo); onMudou?.() } catch (e) { setErro(e.message) }
  }
  return <div style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><h3 style={h3}>Pedidos de compra</h3><p style={sub}>Rascunho → enviado → recebido (parcial ou total). Receber dá entrada no estoque com o custo do pedido.</p></div><button type="button" style={btn} onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : '+ Novo pedido'}</button></div>
    {aberto && <NovoPedido fornecedores={fornecedores} produtos={produtos} onCriado={() => { setAberto(false); onMudou?.() }} />}
    <Aviso texto={erro} />
    <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ ...table, minWidth: 760 }}><thead><tr>{['Pedido', 'Fornecedor', 'Itens', 'Total', 'Previsão', 'Situação', ''].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{pedidos.length === 0 ? <tr><td colSpan={7} style={empty}>Nenhum pedido.</td></tr> : pedidos.map((p) => { const [rot, tom] = STATUS_PEDIDO[p.status] || [p.status, 'neutro']; return <tr key={p.id}>
        <td style={td}><strong>{p.numero}</strong>{p.origem === 'reposicao_automatica' && <div style={sub}>reposição automática</div>}</td>
        <td style={td}>{p.fornecedorNome}</td>
        <td style={td}>{p.itens.map((i) => <div key={i.produtoId}>{i.quantidade}× {i.nome}{i.recebido > 0 && i.recebido < i.quantidade ? ` (recebido ${i.recebido})` : ''}</div>)}</td>
        <td style={td}>{moeda(p.total)}</td>
        <td style={td}>{dataBR(p.previsaoEntrega)}</td>
        <td style={td}><Pill tom={tom}>{rot}</Pill></td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          {p.status === 'rascunho' && <button type="button" style={btn} onClick={() => acao(p, 'enviar')}>Marcar enviado</button>}{' '}
          {['enviado', 'recebido_parcial', 'rascunho'].includes(p.status) && <button type="button" style={btnPrimary} onClick={() => { if (window.confirm(`Receber todo o pendente do ${p.numero} e dar entrada no estoque?`)) acao(p, 'receber', { confirmado: true, chaveIdempotencia: `rec-${Date.now()}` }) }}>Receber tudo</button>}{' '}
          {['rascunho', 'enviado'].includes(p.status) && !p.itens.some((i) => i.recebido > 0) && <button type="button" style={btn} onClick={() => { const motivo = window.prompt('Motivo do cancelamento:'); if (motivo) acao(p, 'cancelar', { motivo }) }}>Cancelar</button>}
        </td>
      </tr> })}</tbody></table></div>
  </div>
}

// ── Reposição ──────────────────────────────────────────────────────────────
function Reposicao({ fornecedores, onPedidos }) {
  const { dados, erro, carregar } = useLista('/api/admin/barbearia/compras/reposicao')
  const [fornecedorPadraoId, setFornecedorPadraoId] = useState('')
  const [msg, setMsg] = useState('')
  async function gerar() {
    setMsg('')
    try {
      const r = await api.post('/api/admin/barbearia/compras/reposicao/pedidos', { fornecedorPadraoId: fornecedorPadraoId || undefined })
      setMsg(`${r.pedidos.length} pedido(s) em rascunho criado(s).${r.semFornecedor.length ? ` Sem fornecedor: ${r.semFornecedor.join(', ')}.` : ''}`)
      carregar(); onPedidos?.()
    } catch (e) { setMsg(e.message) }
  }
  const itens = dados?.itens || []
  return <div style={card}>
    <h3 style={h3}>Reposição sugerida</h3>
    <p style={sub}>Considera o estoque mínimo, o giro dos últimos {dados?.periodoDias || 60} dias, o prazo do fornecedor e o que já está em pedido. Nada é enviado sozinho: os pedidos nascem em rascunho para você revisar.</p>
    <Aviso texto={erro} />
    <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ ...table, minWidth: 760 }}><thead><tr>{['Produto', 'Motivo', 'Estoque', 'Mínimo', 'Em pedido', 'Venda/dia', 'Dura', 'Sugerido', 'Fornecedor'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{itens.length === 0 ? <tr><td colSpan={9} style={empty}>Nenhum item precisa de reposição agora.</td></tr> : itens.map((i) => { const [rot, tom] = MOTIVO[i.motivo] || [i.motivo, 'neutro']; return <tr key={i.produtoId}><td style={td}><strong>{i.nome}</strong></td><td style={td}><Pill tom={tom}>{rot}</Pill></td><td style={td}>{i.estoqueAtual}</td><td style={td}>{i.estoqueMinimo}</td><td style={td}>{i.emPedido}</td><td style={td}>{i.consumoDiario}</td><td style={td}>{i.diasCobertura === null ? '—' : `${i.diasCobertura} d`}</td><td style={td}><strong>{i.quantidadeSugerida}</strong></td><td style={td}>{i.fornecedorNome || '—'}</td></tr> })}</tbody></table></div>
    {itens.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
      <span style={sub}>Estimativa: {moeda(dados?.totalEstimado)}</span>
      <select aria-label="Fornecedor para itens sem fornecedor" value={fornecedorPadraoId} onChange={(e) => setFornecedorPadraoId(e.target.value)} style={input}><option value="">Itens sem fornecedor ficam de fora</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>Itens sem fornecedor → {f.nome}</option>)}</select>
      <button type="button" style={btnPrimary} onClick={gerar}>Gerar pedidos em rascunho</button>
    </div>}
    {msg && <div style={{ ...sub, marginTop: 8 }}>{msg}</div>}
  </div>
}

export function ComprasPanel({ produtos = [], onEstoqueMudou }) {
  const forn = useLista('/api/admin/barbearia/compras/fornecedores')
  const ped = useLista('/api/admin/barbearia/compras/pedidos')
  const notas = useLista('/api/admin/barbearia/compras/nfe')
  const [versao, setVersao] = useState(0)
  const fornecedores = forn.dados?.fornecedores || []
  const pedidos = ped.dados?.pedidos || []
  const abertos = useMemo(() => pedidos.filter((p) => ['rascunho', 'enviado', 'recebido_parcial'].includes(p.status)), [pedidos])
  const atualizar = () => { forn.carregar(); ped.carregar(); notas.carregar(); setVersao((v) => v + 1); onEstoqueMudou?.() }
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}><h2 style={h2}>Compras e fornecedores</h2><p style={sub}>Entrada de mercadoria por XML da nota, pedidos de compra com recebimento parcial e reposição pelo estoque mínimo e pelo giro. O custo médio de cada produto é recalculado a cada entrada.</p></div>
    <NotaEntrada produtos={produtos} pedidosAbertos={abertos} onLancada={atualizar} />
    <Reposicao key={versao} fornecedores={fornecedores} onPedidos={() => ped.carregar()} />
    <Pedidos pedidos={pedidos} fornecedores={fornecedores} produtos={produtos} onMudou={atualizar} />
    <Fornecedores fornecedores={fornecedores} onSalvo={() => forn.carregar()} />
    <div style={card}><h3 style={h3}>Notas lançadas</h3>
      <div style={{ overflowX: 'auto', marginTop: 10 }}><table style={table}><thead><tr>{['NF-e', 'Fornecedor', 'Valor', 'Itens', 'Lançada em'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{(notas.dados?.notas || []).length === 0 ? <tr><td colSpan={5} style={empty}>Nenhuma nota lançada.</td></tr> : notas.dados.notas.map((n) => <tr key={n.chave}><td style={td}>{n.numero}/{n.serie}</td><td style={td}>{n.fornecedorNome}</td><td style={td}>{moeda(n.valorNota)}</td><td style={td}>{n.entradas.length}{n.ignorados.length ? ` (+${n.ignorados.length} ignorado)` : ''}</td><td style={td}>{dataBR(n.lancadaEm)}</td></tr>)}</tbody></table></div>
    </div>
  </div>
}

// ── Curva ABC ──────────────────────────────────────────────────────────────
export function CurvaAbcPanel() {
  const [dias, setDias] = useState(90)
  const [criterio, setCriterio] = useState('receita')
  const { dados, erro } = useLista(`/api/admin/barbearia/compras/curva-abc?dias=${dias}&criterio=${criterio}`)
  const linhas = dados?.linhas || []
  const corClasse = { A: 'bom', B: 'alerta', C: 'neutro' }
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div><h2 style={h2}>Curva ABC e margem</h2><p style={sub}>A: produtos que somam até 80% da {criterio === 'margem' ? 'margem' : 'receita'}; B: até 95%; C: o resto. Margem = receita − custo médio × quantidade. Inclui balcão e comandas.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ ...input, minWidth: 170 }}>{[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}</select>
          <select aria-label="Critério" value={criterio} onChange={(e) => setCriterio(e.target.value)} style={input}><option value="receita">Por receita</option><option value="margem">Por margem</option></select>
        </div>
      </div>
      <Aviso texto={erro} />
      <div style={{ ...grid(160), marginTop: 14 }}>
        <div style={kpi}><div style={kpiLabel}>Receita</div><div style={kpiValue}>{moeda(dados?.receitaTotal)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Margem</div><div style={{ ...kpiValue, color: tons.bom }}>{moeda(dados?.margemTotal)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Em estoque (custo)</div><div style={kpiValue}>{moeda(dados?.valorEmEstoque)}</div></div>
        <div style={kpi}><div style={kpiLabel}>Parados</div><div style={{ ...kpiValue, color: (dados?.parados?.length || 0) ? tons.alerta : 'inherit' }}>{dados?.parados?.length || 0}</div><div style={sub}>com estoque e sem venda</div></div>
      </div>
      {(dados?.semCusto || 0) > 0 && <div style={{ ...sub, color: tons.alerta, marginTop: 8 }}>{dados.semCusto} produto(s) sem custo cadastrado: a margem deles aparece cheia. Lance a NF-e de entrada ou informe o custo.</div>}
      <div style={{ ...grid(160), marginTop: 10 }}>{(dados?.resumo || []).map((r) => <div key={r.classe} style={kpi}><div style={kpiLabel}>Classe {r.classe}</div><div style={{ fontWeight: 800, marginTop: 6 }}>{r.itens} item(ns)</div><div style={sub}>{moeda(r.receita)} · margem {moeda(r.margem)}</div></div>)}</div>
    </div>
    <div style={{ ...card, overflowX: 'auto' }}><table style={{ ...table, minWidth: 820 }}><thead><tr>{['Classe', 'Produto', 'Qtd', 'Receita', 'Margem', 'Margem %', 'Part. %', 'Acum. %', 'Estoque', 'Giro'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{linhas.length === 0 ? <tr><td colSpan={10} style={empty}>Sem produtos no período.</td></tr> : linhas.map((l) => <tr key={l.produtoId}><td style={td}><Pill tom={corClasse[l.classe]}>{l.classe}</Pill></td><td style={td}><strong>{l.nome}</strong>{l.parado && <div style={{ ...sub, color: tons.alerta }}>parado</div>}</td><td style={td}>{l.quantidade}</td><td style={td}>{moeda(l.receita)}</td><td style={td}>{moeda(l.margem)}</td><td style={td}>{l.margemPercentual === null ? '—' : `${l.margemPercentual}%`}</td><td style={td}>{l.participacao}%</td><td style={td}>{l.acumulado}%</td><td style={td}>{l.estoqueAtual}</td><td style={td}>{l.giro ?? '—'}</td></tr>)}</tbody></table></div>
  </div>
}

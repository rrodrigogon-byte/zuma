// Extrato do profissional, vales (adiantamentos), repasse com recibo e estorno,
// comissão sobre planos (pote) e a régua de cobrança do clube.
import { useCallback, useEffect, useState } from 'react'
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
const kpiValue = { fontSize: 22, fontWeight: 800, marginTop: 6, fontFamily: 'var(--font-display)' }
const empty = { padding: 22, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }
const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12 })
const moeda = (v) => fmtR(Number(v || 0))
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')
const ok = '#14b87a'; const ruim = '#e05c5c'; const alerta = '#f59e0b'

function hojeIso() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date()) }
function inicioSemana() { const d = new Date(`${hojeIso()}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }

// Abre HTML autenticado (recibo) numa janela nova.
export async function abrirHtmlAutenticado(rota) {
  const janela = window.open('', '_blank')
  let emp = ''; try { emp = JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')?.id || '' } catch { emp = '' }
  let loja = ''; try { loja = JSON.parse(localStorage.getItem('sp_loja_ativa') || 'null')?.id || '' } catch { loja = '' }
  try {
    const r = await fetch(rota, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('sp_token') || ''), ...(emp ? { 'X-Empresa-Id': emp } : {}), ...(loja ? { 'X-Loja-Id': loja } : {}) } })
    if (!r.ok) throw new Error('Não foi possível abrir o documento.')
    const url = URL.createObjectURL(await r.blob())
    if (janela) janela.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) { janela?.close(); throw e }
}

export function ExtratoTabela({ extrato }) {
  if (!extrato) return null
  const t = extrato.totais
  return <div style={{ display: 'grid', gap: 12 }}>
    <div style={grid(150)}>
      <div style={kpi}><div style={kpiLabel}>Bruto atendido</div><div style={kpiValue}>{moeda(t.bruto)}</div><div style={sub}>{t.atendimentos} serviço(s) · {t.vendasProdutos} venda(s)</div></div>
      <div style={kpi}><div style={kpiLabel}>Taxas + material</div><div style={kpiValue}>{moeda(t.taxas + t.materiais)}</div><div style={sub}>taxa {moeda(t.taxas)} · material {moeda(t.materiais)}</div></div>
      <div style={kpi}><div style={kpiLabel}>Comissão</div><div style={{ ...kpiValue, color: ok }}>{moeda(t.comissaoTotal)}</div><div style={sub}>serviços {moeda(t.comissaoServicos)} · produtos {moeda(t.comissaoProdutos)} · planos {moeda(t.comissaoPlanos)}</div></div>
      <div style={kpi}><div style={kpiLabel}>Vales em aberto</div><div style={{ ...kpiValue, color: t.valesAbertos ? alerta : 'inherit' }}>{moeda(t.valesAbertos)}</div></div>
      <div style={kpi}><div style={kpiLabel}>A receber</div><div style={kpiValue}>{moeda(t.aReceber)}</div><div style={sub}>já repassado {moeda(t.jaRepassado)}</div></div>
    </div>
    {extrato.meiosSemTaxaConfigurada?.length > 0 && <div style={{ ...sub, color: alerta }}>Sem taxa cadastrada para: {extrato.meiosSemTaxaConfigurada.join(', ')}. A comissão desses meios foi calculada sobre o bruto (configure em Gestão → Comissões).</div>}
    <div style={{ overflowX: 'auto' }}><table style={{ ...table, minWidth: 820 }}><thead><tr>{['Data', 'Item', 'Cliente', 'Bruto', 'Taxa', 'Material', 'Base', '%', 'Comissão'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{extrato.linhas.length === 0 && extrato.pote.length === 0 ? <tr><td colSpan={9} style={empty}>Nada no período.</td></tr> : <>
        {extrato.linhas.map((l, i) => <tr key={`${l.origemId}-${i}`}><td style={td}>{dataBR(l.data)}</td><td style={td}>{l.descricao}<div style={sub}>{l.tipo === 'produto' ? 'produto' : 'serviço'}</div></td><td style={td}>{l.cliente || '—'}</td><td style={td}>{moeda(l.bruto)}</td><td style={td}>{moeda(l.taxa)}</td><td style={td}>{moeda(l.material)}</td><td style={td}>{moeda(l.base)}</td><td style={td}>{l.percentual}%</td><td style={td}><strong>{moeda(l.comissao)}</strong></td></tr>)}
        {extrato.pote.map((p) => <tr key={p.planoId}><td style={td}>—</td><td style={td}>Pote do plano {p.plano}<div style={sub}>{p.pontos} de {p.totalPontos} pontos</div></td><td style={td}>—</td><td style={td} colSpan={5} /><td style={td}><strong>{moeda(p.valor)}</strong></td></tr>)}
      </>}</tbody></table></div>
  </div>
}

export function HistoricoAvecExtrato({ historico }) {
  const [limite, setLimite] = useState(100)
  if (!historico) return null
  const linhas = historico.linhas || []
  return <div style={card}>
    <h3 style={h3}>Histórico Avec no período</h3>
    <p style={sub}>Atendimentos importados do Avec{historico.nomesAvec?.length ? ` (${historico.nomesAvec.join(', ')})` : ''}, com a comissão pela regra de {historico.percentual}%{historico.regraDe ? ` de ${historico.regraDe}` : ' do cadastro'}. É só consulta: esse período foi acertado no Avec, não entra no "a receber" nem gera repasse.</p>
    <div style={{ ...grid(150), marginTop: 12 }}>
      <div style={kpi}><div style={kpiLabel}>Atendimentos</div><div style={kpiValue}>{historico.atendimentos}</div><div style={sub}>{historico.comValor} com valor na comanda</div></div>
      <div style={kpi}><div style={kpiLabel}>Bruto no Avec</div><div style={kpiValue}>{moeda(historico.bruto)}</div></div>
      <div style={kpi}><div style={kpiLabel}>Percentual</div><div style={kpiValue}>{historico.percentual}%</div></div>
      <div style={kpi}><div style={kpiLabel}>Comissão calculada</div><div style={{ ...kpiValue, color: ok }}>{moeda(historico.comissao)}</div><div style={sub}>referência do período Avec</div></div>
    </div>
    <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ ...table, minWidth: 760 }}><thead><tr>{['Data', 'Serviço', 'Cliente', 'Comanda', 'Profissional no Avec', 'Bruto', '%', 'Comissão'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
      <tbody>{linhas.length === 0 ? <tr><td colSpan={8} style={empty}>Nenhum atendimento do Avec no período.</td></tr> : linhas.slice(0, limite).map((l, i) => <tr key={`${l.data}-${l.comanda}-${i}`}><td style={td}>{dataBR(l.data)}</td><td style={td}>{l.descricao}{l.frente ? <div style={sub}>{l.frente}</div> : null}</td><td style={td}>{l.cliente || '—'}</td><td style={td}>{l.comanda || '—'}</td><td style={td}>{l.profissionalAvec || '—'}</td><td style={td}>{moeda(l.bruto)}</td><td style={td}>{l.percentual}%</td><td style={td}><strong>{moeda(l.comissao)}</strong></td></tr>)}</tbody></table></div>
    {linhas.length > limite && <button type="button" style={{ ...btn, marginTop: 10 }} onClick={() => setLimite((v) => v + 200)}>Mostrar mais ({linhas.length - limite} restantes)</button>}
    {historico.linhasOmitidas > 0 && <div style={{ ...sub, marginTop: 6 }}>{historico.linhasOmitidas} linha(s) além das 2.000 primeiras ficaram fora da lista; os totais consideram todas.</div>}
  </div>
}

function inicioMes(deslocamento = 0) { const d = new Date(`${hojeIso()}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth() + deslocamento); return d.toISOString().slice(0, 10) }
function fimMes(deslocamento = 0) { const d = new Date(`${inicioMes(deslocamento + 1)}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

function RegrasComissao({ servicos = [], planos = [], onSalvo }) {
  const [material, setMaterial] = useState({})
  const [pote, setPote] = useState({})
  const [msg, setMsg] = useState('')
  async function salvarServico(servico) {
    const bruto = material[servico.id]
    try {
      await api.patch(`/api/admin/barbearia/servicos/${servico.id}`, { ...servico, custoMaterial: bruto === '' ? null : Number(String(bruto).replace(',', '.')) })
      setMsg(`Material de ${servico.nome} salvo.`); onSalvo?.()
    } catch (e) { setMsg(e.message) }
  }
  async function salvarPlano(plano) {
    try {
      await api.patch(`/api/admin/barbearia/planos/${plano.id}`, { ...plano, percentualPote: Number(pote[plano.id]) })
      setMsg(`Pote do plano ${plano.nome} salvo.`); onSalvo?.()
    } catch (e) { setMsg(e.message) }
  }
  return <div style={grid(320)}>
    <div style={card}>
      <h3 style={h3}>Material por serviço</h3>
      <p style={sub}>Desconta da base da comissão de quem tem "descontar material" no cadastro. Em branco, usa o custo dos insumos da ficha técnica.</p>
      <div style={{ overflowX: 'auto', marginTop: 8 }}><table style={table}><tbody>{servicos.filter((sv) => sv.ativo !== false).map((sv) => <tr key={sv.id}><td style={td}>{sv.nome}</td><td style={td}><input aria-label={`Material de ${sv.nome}`} placeholder="Ficha técnica" inputMode="decimal" value={material[sv.id] ?? (sv.custoMaterial ?? '')} onChange={(e) => setMaterial({ ...material, [sv.id]: e.target.value })} style={{ ...input, width: 120 }} /></td><td style={td}><button type="button" style={btn} onClick={() => salvarServico(sv)}>Salvar</button></td></tr>)}</tbody></table></div>
    </div>
    <div style={card}>
      <h3 style={h3}>Comissão sobre planos (pote)</h3>
      <p style={sub}>Percentual de cada mensalidade que vai para o pote dividido entre quem atendeu pelo plano.</p>
      {planos.filter((pl) => pl.ativo !== false).length === 0 && <div style={empty}>Nenhum plano ativo. Crie em Catálogo → Planos e assinaturas.</div>}<div style={{ overflowX: 'auto', marginTop: 8 }}><table style={table}><tbody>{planos.filter((pl) => pl.ativo !== false).map((pl) => <tr key={pl.id}><td style={td}>{pl.nome}<div style={sub}>{moeda(pl.preco)}</div></td><td style={td}><input aria-label={`Pote do plano ${pl.nome}`} type="number" min="0" max="100" value={pote[pl.id] ?? (pl.percentualPote || 0)} onChange={(e) => setPote({ ...pote, [pl.id]: e.target.value })} style={{ ...input, width: 80 }} /> %</td><td style={td}><button type="button" style={btn} onClick={() => salvarPlano(pl)}>Salvar</button></td></tr>)}</tbody></table></div>
    </div>
    {msg && <div style={{ ...sub, gridColumn: '1 / -1' }}>{msg}</div>}
  </div>
}

export function RepassesPanel({ profissionais: profissionaisBase = [], servicos = [], planos = [], onCadastroMudou }) {
  // Inclui os inativos (equipe antiga e nomes do histórico Avec) para consultar o histórico deles.
  const [todos, setTodos] = useState(null)
  useEffect(() => { let vivo = true; api.get('/api/admin/barbearia/profissionais?incluirInativos=true').then((r) => { if (vivo && Array.isArray(r?.profissionais)) setTodos(r.profissionais) }).catch(() => null); return () => { vivo = false } }, [])
  const profissionais = todos?.length ? todos : profissionaisBase
  const ativos = profissionais.filter((p) => p.ativo !== false)
  const inativos = profissionais.filter((p) => p.ativo === false).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  const [profissionalId, setProfissionalId] = useState(ativos[0]?.id || '')
  const [inicio, setInicio] = useState(inicioSemana())
  const [fim, setFim] = useState(hojeIso())
  const [extrato, setExtrato] = useState(null)
  const [repasses, setRepasses] = useState([])
  const [pote, setPote] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [vale, setVale] = useState({ valor: '', motivo: '' })
  const [meio, setMeio] = useState('pix')

  const carregar = useCallback(async () => {
    if (!profissionalId) return
    setErro('')
    try {
      const [e, r, p] = await Promise.all([
        api.get(`/api/admin/barbearia/comissoes/extrato?profissionalId=${encodeURIComponent(profissionalId)}&inicio=${inicio}&fim=${fim}`),
        api.get(`/api/admin/barbearia/comissoes/repasses?profissionalId=${encodeURIComponent(profissionalId)}`),
        api.get(`/api/admin/barbearia/comissoes/pote?inicio=${inicio}&fim=${fim}`),
      ])
      setExtrato(e.extrato); setRepasses(r.repasses || []); setPote(p)
    } catch (err) { setErro(err.message) }
  }, [profissionalId, inicio, fim])
  useEffect(() => { carregar() }, [carregar])

  async function registrarRepasse() {
    if (!extrato) return
    const valor = extrato.totais.comissaoTotal - extrato.totais.valesAbertos
    if (!window.confirm(`Registrar o repasse de ${moeda(Math.max(0, valor))} para ${extrato.profissional.nome} (${dataBR(inicio)} a ${dataBR(fim)}), pago por ${meio}? O pagamento em si é feito por você; aqui fica o registro e o recibo.`)) return
    setMsg(''); setErro('')
    try {
      const r = await api.post('/api/admin/barbearia/comissoes/repasses', { profissionalId, inicio, fim, meio, confirmado: true })
      setMsg(`Repasse ${r.repasse.recibo} registrado.`); carregar()
      abrirHtmlAutenticado(`/api/admin/barbearia/comissoes/repasses/${r.repasse.id}/recibo`).catch(() => null)
    } catch (e) { setErro(e.message) }
  }
  async function registrarVale(ev) {
    ev.preventDefault(); setMsg(''); setErro('')
    try {
      await api.post('/api/admin/barbearia/comissoes/vales', { profissionalId, valor: Number(String(vale.valor).replace(',', '.')), motivo: vale.motivo, meio, confirmado: true, chaveIdempotencia: `vale-${profissionalId}-${Date.now()}` })
      setVale({ valor: '', motivo: '' }); setMsg('Vale registrado: será abatido no próximo repasse.'); carregar()
    } catch (e) { setErro(e.message) }
  }
  async function estornar(r) {
    const motivo = window.prompt(`Motivo do estorno do ${r.recibo}:`)
    if (!motivo) return
    try { await api.post(`/api/admin/barbearia/comissoes/repasses/${r.id}/estorno`, { motivo }); carregar() } catch (e) { setErro(e.message) }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={card}>
      <h2 style={h2}>Extrato e repasses</h2>
      <p style={sub}>Extrato por período com taxa e material descontados da base, comissão de produtos e a parte do pote dos planos. O repasse gera recibo numerado, abate os vales e lança a despesa no financeiro; um período já repassado não é pago de novo.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <select aria-label="Profissional" value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)} style={{ ...input, width: 'auto', minWidth: 180 }}><optgroup label="Equipe ativa">{ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>{inativos.length > 0 && <optgroup label="Inativos e histórico Avec">{inativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>}</select>
        <input aria-label="Início" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ ...input, width: 'auto' }} />
        <input aria-label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} style={{ ...input, width: 'auto' }} />
        <select aria-label="Meio do pagamento" value={meio} onChange={(e) => setMeio(e.target.value)} style={{ ...input, width: 'auto' }}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select>
        <button type="button" style={btnPrimary} onClick={registrarRepasse} disabled={!extrato || extrato.totais.comissaoTotal <= 0}>Registrar repasse e gerar recibo</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {[['Esta semana', inicioSemana(), hojeIso()], ['Este mês', inicioMes(0), hojeIso()], ['Mês passado', inicioMes(-1), fimMes(-1)], ['Últimos 12 meses', inicioMes(-11), hojeIso()], ['Todo o histórico', '2025-01-01', hojeIso()]].map(([rotulo, de, ate]) => <button key={rotulo} type="button" style={{ ...btn, ...(inicio === de && fim === ate ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }} onClick={() => { setInicio(de); setFim(ate) }}>{rotulo}</button>)}
      </div>
      {erro && <div role="alert" style={{ color: ruim, fontSize: 13, marginTop: 8 }}>{erro}</div>}
      {msg && <div style={{ color: ok, fontSize: 13, marginTop: 8 }}>{msg}</div>}
    </div>
    <div style={card}><ExtratoTabela extrato={extrato} /></div>
    <HistoricoAvecExtrato historico={extrato?.historicoAvec} />
    <div style={grid(320)}>
      <div style={card}>
        <h3 style={h3}>Vale (adiantamento)</h3>
        <p style={sub}>Limitado à comissão já realizada e ainda não repassada. É abatido automaticamente no próximo repasse.</p>
        <form onSubmit={registrarVale} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <input aria-label="Valor do vale" placeholder="Valor (R$)" inputMode="decimal" required value={vale.valor} onChange={(e) => setVale({ ...vale, valor: e.target.value })} style={{ ...input, width: 120 }} />
          <input aria-label="Motivo do vale" placeholder="Motivo" value={vale.motivo} onChange={(e) => setVale({ ...vale, motivo: e.target.value })} style={{ ...input, flex: 1 }} />
          <button type="submit" style={btn}>Registrar vale</button>
        </form>
        {(extrato?.vales || []).map((v) => <div key={v.id} style={{ ...sub, marginTop: 6 }}>{dataBR(v.criadoEm)} · {moeda(v.valor)} {v.motivo ? `· ${v.motivo}` : ''}</div>)}
      </div>
      <div style={card}>
        <h3 style={h3}>Pote dos planos no período</h3>
        <p style={sub}>Parte da mensalidade definida em cada plano, dividida pelo valor de tabela dos serviços que cada profissional atendeu pelo plano.</p>
        {(pote?.planos || []).length === 0 ? <div style={empty}>Nenhum plano com pote ou nenhuma mensalidade no período.</div> : pote.planos.map((p) => <div key={p.planoId} style={{ marginTop: 8, fontSize: 13 }}><strong>{p.plano}</strong> · {p.percentualPote}% de {moeda(p.receita)} = {moeda(p.pote)}{p.semRateio > 0 ? <span style={{ color: alerta }}> · {moeda(p.semRateio)} sem uso para dividir</span> : null}</div>)}
      </div>
    </div>
    <RegrasComissao servicos={servicos} planos={planos} onSalvo={() => { onCadastroMudou?.(); carregar() }} />
    <div style={card}>
      <h3 style={h3}>Repasses de {extrato?.profissional?.nome || '—'}</h3>
      <div style={{ overflowX: 'auto', marginTop: 10 }}><table style={{ ...table, minWidth: 680 }}><thead><tr>{['Recibo', 'Período', 'Comissão', 'Vales', 'Pago', 'Meio', 'Situação', ''].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{repasses.length === 0 ? <tr><td colSpan={8} style={empty}>Nenhum repasse registrado.</td></tr> : repasses.map((r) => <tr key={r.id}><td style={td}><strong>{r.recibo}</strong></td><td style={td}>{dataBR(r.inicio)} a {dataBR(r.fim)}</td><td style={td}>{moeda(r.comissaoTotal)}</td><td style={td}>{moeda(r.valesAbatidos)}</td><td style={td}>{moeda(r.valorPago)}</td><td style={td}>{r.meio}</td><td style={td} title={r.motivoEstorno || ''}>{r.status === 'estornado' ? <span style={{ color: ruim }}>Estornado</span> : <span style={{ color: ok }}>Pago {dataBR(r.pagoEm)}</span>}</td><td style={{ ...td, whiteSpace: 'nowrap' }}><button type="button" style={btn} onClick={() => abrirHtmlAutenticado(`/api/admin/barbearia/comissoes/repasses/${r.id}/recibo`).catch((e) => setErro(e.message))}>Recibo</button>{' '}{r.status === 'pago' && <button type="button" style={btn} onClick={() => estornar(r)}>Estornar</button>}</td></tr>)}</tbody></table></div>
    </div>
  </div>
}

export function ReguaClubePanel() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => { try { setDados(await api.get('/api/admin/barbearia/cobrancas/regua-clube')) } catch (e) { setErro(e.message) } }, [])
  useEffect(() => { carregar() }, [carregar])
  const r = dados?.regra
  return <div style={card}>
    <h3 style={h3}>Régua de cobrança do clube</h3>
    {r && <p style={sub}>{r.ativa ? 'Ligada' : 'Desligada'}: 1º aviso {r.diasAntes} dia(s) antes do vencimento; até {r.tentativas} tentativas (no vencimento e a cada {r.intervaloDias} dia(s)); {r.bloquearAutomatico ? `plano pausado após ${r.bloquearAposDias} dia(s) de atraso e reativado sozinho quando pago` : 'sem pausa automática'}. Ajuste em Gestão → Cobranças e cashback.</p>}
    {erro && <div role="alert" style={{ color: ruim, fontSize: 13 }}>{erro}</div>}
    <div style={{ ...grid(150), marginTop: 12 }}>
      <div style={kpi}><div style={kpiLabel}>Mensalidades em aberto</div><div style={kpiValue}>{dados?.pendentes?.length || 0}</div></div>
      <div style={kpi}><div style={kpiLabel}>Planos pausados por atraso</div><div style={{ ...kpiValue, color: (dados?.bloqueadas?.length || 0) ? ruim : 'inherit' }}>{dados?.bloqueadas?.length || 0}</div></div>
      <div style={kpi}><div style={kpiLabel}>Reativados após pagar</div><div style={{ ...kpiValue, color: ok }}>{dados?.reativadas?.length || 0}</div></div>
    </div>
    {(dados?.pendentes || []).length > 0 && <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={table}><thead><tr>{['Cliente', 'Valor', 'Vencimento', 'Tentativas'].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead><tbody>{dados.pendentes.map((p) => <tr key={p.id}><td style={td}>{p.clienteNome || '—'}</td><td style={td}>{moeda(p.valor)}</td><td style={td}>{dataBR(p.vencimento)}</td><td style={td}>{p.tentativas}/{r?.tentativas}</td></tr>)}</tbody></table></div>}
  </div>
}

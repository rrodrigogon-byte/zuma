import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { Badge, Dialog, Table } from '../customer360/shared'

// Classificação fiscal com pesquisa completa e cadastro conferido nas tabelas oficiais:
// NCM (Siscomex), CEST (Convênio ICMS 142/2018), CFOP, Lista de Serviços Nacional da NFS-e.
// A conferência roda no servidor (/classificacoes/conferir); erro bloqueia a gravação, aviso só orienta.

const BASE = '/api/admin/fiscal'
const POR_PAGINA = 60
const VAZIO = { ncm: '', cest: '', cfop: '', origem: '0', csosn: '', cstIcms: '', aliquotaIcms: '', reducaoBaseIcms: '', cstPis: '', cstCofins: '', aliquotaPis: '', aliquotaCofins: '', unidadeTributavel: 'UN', cTribNac: '', aliquotaIss: '', cstIbsCbs: '', cClassTrib: '' }
const ORIGENS = [['0', '0 · Nacional'], ['1', '1 · Estrangeira, importação direta'], ['2', '2 · Estrangeira, adquirida no mercado interno'], ['3', '3 · Nacional, conteúdo importado > 40% e ≤ 70%'], ['4', '4 · Nacional, processos produtivos básicos'], ['5', '5 · Nacional, conteúdo importado ≤ 40%'], ['6', '6 · Estrangeira, importação direta, sem similar (CAMEX)'], ['7', '7 · Estrangeira, mercado interno, sem similar (CAMEX)'], ['8', '8 · Nacional, conteúdo importado > 70%']]
const CST_IBSCBS = [['', '— padrão (000 / 000001, tributação integral)'], ['000', '000 · Tributação integral'], ['410', '410 · Imunidade e não incidência']]
const SITUACOES = [['todas', 'Todas'], ['sem', 'Sem classificação'], ['erro', 'Com erro'], ['aviso', 'Com aviso'], ['ok', 'Corretas'], ['herdadas', 'Herdadas da categoria'], ['orfas', 'Serviços sem cadastro']]
const TOM = { sem: 'warning', erro: 'danger', aviso: 'warning', ok: 'success' }
const ROTULO_SITUACAO = { sem: 'Sem classificação', erro: 'Com erro', aviso: 'Com aviso', ok: 'Correta' }
const ORDEM_SITUACAO = { erro: 0, sem: 1, aviso: 2, ok: 3 }
const ROTULO_CATEGORIA = { 'barbearia:revenda': 'Revenda da barbearia (padrão para os produtos da comanda)', 'barbearia:servicos': 'Serviços da barbearia (padrão para os serviços da comanda)' }

const soDig = (v) => String(v ?? '').replace(/\D/g, '')
const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const fmtNcm = (c) => (soDig(c).length === 8 ? `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}` : c || '—')
const fmtCest = (c) => (soDig(c).length === 7 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 7)}` : c)
const chaveItem = (i) => `${i.fonte}:${i.fonteId}`
const lerPreferencias = () => { try { return JSON.parse(localStorage.getItem('kytto_fiscal_classificacao_filtros') || 'null') || {} } catch { return {} } }
const gravarPreferencias = (v) => { try { localStorage.setItem('kytto_fiscal_classificacao_filtros', JSON.stringify(v)) } catch { /* sem armazenamento */ } }
// campos da classificação que voltam para o formulário (sem nulos, que viram "null" nos inputs)
function limpar(c) {
  if (!c) return {}
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]))
}

function resumoCodigos(c) {
  if (!c) return null
  if (c.tipo === 'servico') return `cTribNac ${c.cTribNac || '—'}${c.aliquotaIss ? ` · ISS ${c.aliquotaIss}%` : ''}`
  return [`NCM ${fmtNcm(c.ncm)}`, `CFOP ${c.cfop || '—'}`, c.csosn ? `CSOSN ${c.csosn}` : c.cstIcms ? `CST ${c.cstIcms}` : null, c.cest ? `CEST ${fmtCest(c.cest)}` : null].filter(Boolean).join(' · ')
}

// ── busca nas tabelas oficiais (NCM e Lista de Serviços Nacional) ────────────
function BuscaTabela({ tipo, rotulo, onEscolher }) {
  const [q, setQ] = useState('')
  const [itens, setItens] = useState([])
  const [buscando, setBuscando] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    const termo = q.trim()
    if (termo.length < 2) { setItens([]); return undefined }
    const n = ++seq.current
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await api.get(`${BASE}/classificacoes/referencias?tipo=${tipo}&q=${encodeURIComponent(termo)}`)
        if (n === seq.current) setItens(Array.isArray(r?.itens) ? r.itens : [])
      } catch { if (n === seq.current) setItens([]) } finally { if (n === seq.current) setBuscando(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, tipo])
  return <div className="dadm-card" style={{ padding: 10, margin: 0 }}>
    <label className="c360-field">{rotulo}<input className="c360-input" type="search" aria-label={rotulo} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tipo === 'ncm' ? 'ex.: perfume, xampu, 3305' : 'ex.: barbearia, 0601'} /></label>
    {buscando && <p className="dadm-muted">Buscando…</p>}
    {!buscando && q.trim().length >= 2 && !itens.length && <p className="dadm-muted">Nada encontrado na tabela oficial.</p>}
    {itens.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 4 }}>
      {itens.map((x) => <li key={x.codigo}><button type="button" className="c360-btn ghost" style={{ width: '100%', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => { onEscolher(x); setQ(''); setItens([]) }}>
        <strong>{tipo === 'ncm' ? x.formatado : `${x.codigo} · ${x.item}`}</strong> {tipo === 'ncm' ? x.caminho : x.descricao}
      </button></li>)}
    </ul>}
  </div>
}

// ── formulário completo ──────────────────────────────────────────────────────
function FormularioClassificacao({ form, setForm, refs, regime, perfis, conferencia }) {
  const [ncmInfo, setNcmInfo] = useState(null)
  const [servicoInfo, setServicoInfo] = useState(null)
  const [verBuscaNcm, setVerBuscaNcm] = useState(false)
  const [verBuscaServico, setVerBuscaServico] = useState(false)
  const [cfopLivre, setCfopLivre] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const servico = form.tipo === 'servico'
  const ncm = soDig(form.ncm)
  useEffect(() => {
    if (servico || ncm.length !== 8) { setNcmInfo(null); return undefined }
    let vivo = true
    api.get(`${BASE}/classificacoes/referencias?tipo=ncm-detalhe&q=${ncm}`).then((r) => { if (vivo) setNcmInfo(r || null) }).catch(() => { if (vivo) setNcmInfo(null) })
    return () => { vivo = false }
  }, [ncm, servico])
  const ctrib = soDig(form.cTribNac)
  useEffect(() => {
    if (!servico || ctrib.length !== 6) { setServicoInfo(null); return undefined }
    let vivo = true
    api.get(`${BASE}/classificacoes/referencias?tipo=servico&q=${ctrib}&limite=5`).then((r) => { if (vivo) setServicoInfo((r?.itens || []).find((s) => s.codigo === ctrib) || false) }).catch(() => { if (vivo) setServicoInfo(null) })
    return () => { vivo = false }
  }, [ctrib, servico])
  const erroDe = (campo) => (conferencia?.erros || []).filter((e) => e.campo === campo).map((e) => e.mensagem).join(' ')
  const avisoDe = (campo) => (conferencia?.avisos || []).filter((e) => e.campo === campo).map((e) => e.mensagem).join(' ')
  const Nota = ({ campo }) => <>
    {erroDe(campo) && <span role="alert" style={{ display: 'block', color: 'var(--danger, #c0392b)', fontSize: 12 }}>{erroDe(campo)}</span>}
    {!erroDe(campo) && avisoDe(campo) && <span style={{ display: 'block', color: 'var(--warning, #b7791f)', fontSize: 12 }}>{avisoDe(campo)}</span>}
  </>
  const aplicarPerfil = (id) => { const p = perfis.find((x) => x.id === id); if (p) setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(p.valores).map(([k, v]) => [k, String(v)])) })) }
  const ibsCbs = <>
    <label className="c360-field">CST do IBS/CBS<select className="c360-input" aria-label="CST do IBS/CBS" value={form.cstIbsCbs || ''} onChange={(e) => setForm((f) => ({ ...f, cstIbsCbs: e.target.value, cClassTrib: e.target.value ? (f.cClassTrib && f.cClassTrib.startsWith(e.target.value) ? f.cClassTrib : `${e.target.value}001`) : '' }))}>{CST_IBSCBS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
    <label className="c360-field">cClassTrib (6 dígitos)<input className="c360-input" aria-label="cClassTrib" inputMode="numeric" maxLength={6} disabled={!form.cstIbsCbs} value={form.cClassTrib || ''} placeholder="000001" onChange={(e) => set('cClassTrib', soDig(e.target.value))} /></label>
  </>

  if (servico) {
    return <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <label className="c360-field">Código de tributação nacional (cTribNac)<input className="c360-input" aria-label="cTribNac" required inputMode="numeric" maxLength={6} value={form.cTribNac || ''} onChange={(e) => set('cTribNac', soDig(e.target.value))} />
          {servicoInfo && <span className="dadm-muted" style={{ fontSize: 12 }}>{servicoInfo.item} · {servicoInfo.descricao}</span>}
          <Nota campo="cTribNac" />
        </label>
        <label className="c360-field">Alíquota do ISS (%)<input className="c360-input" aria-label="Alíquota do ISS" inputMode="decimal" value={form.aliquotaIss ?? ''} onChange={(e) => set('aliquotaIss', e.target.value)} /><Nota campo="aliquotaIss" /></label>
      </div>
      <button type="button" className="c360-btn ghost" onClick={() => setVerBuscaServico((v) => !v)}>{verBuscaServico ? 'Fechar pesquisa' : 'Pesquisar na Lista de Serviços Nacional'}</button>
      {verBuscaServico && <BuscaTabela tipo="servico" rotulo="Pesquisar serviço (descrição ou código)" onEscolher={(s) => { set('cTribNac', s.codigo); setVerBuscaServico(false) }} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{ibsCbs}</div>
      <p className="dadm-muted" style={{ margin: 0 }}>Barbearia e cabeleireiro: 06.01 (cTribNac 060101). Estética: 06.02 (060201). A alíquota do ISS é a do município (2% a 5%).</p>
    </div>
  }

  const cests = ncmInfo?.cests || []
  const cestForaDaLista = form.cest && !cests.some((c) => c.codigo === soDig(form.cest))
  const cfops = refs?.cfopsUsuais || []
  const cfopForaDaLista = form.cfop && !cfops.some((c) => c.codigo === soDig(form.cfop))
  const mostrarCsosn = regime !== 'normal' || form.csosn
  const mostrarCst = regime !== 'simples' || form.cstIcms
  return <div style={{ display: 'grid', gap: 10 }}>
    {perfis.length > 0 && <label className="c360-field">Perfil pronto (preenche CFOP, CSOSN/CST e PIS/COFINS)<select className="c360-input" aria-label="Perfil fiscal" value="" onChange={(e) => aplicarPerfil(e.target.value)}><option value="">— escolher —</option>{perfis.filter((p) => !regime || !p.regime || p.regime === regime || p.id === 'monofasico').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>}
    {(form.sugestoes || []).map((s, i) => <p key={i} className={`dadm-note ${s.valido ? '' : 'warn'}`} style={{ margin: 0 }}>
      {s.origem === 'cadastro' ? 'NCM do cadastro do estoque' : 'Sugestão pelo nome'}: <strong>{fmtNcm(s.ncm)}</strong>{s.cest ? ` · CEST ${fmtCest(s.cest)}` : ''} — {s.descricao || 'NCM inexistente na tabela vigente'}{s.valido ? '' : ' (confira: não bate com a tabela oficial)'}
      {s.valido && <button type="button" className="c360-btn ghost" style={{ marginLeft: 8 }} onClick={() => setForm((f) => ({ ...f, ncm: s.ncm, ...(s.cest ? { cest: s.cest } : {}) }))}>Usar</button>}
    </p>)}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <label className="c360-field">NCM (8 dígitos)<input className="c360-input" aria-label="NCM" required={form.fonte !== 'categoria'} inputMode="numeric" maxLength={10} value={form.ncm || ''} onChange={(e) => set('ncm', soDig(e.target.value))} />
        {ncmInfo?.ncm && <span className="dadm-muted" style={{ fontSize: 12 }}>{ncmInfo.ncm.caminho}</span>}
        <Nota campo="ncm" />
      </label>
      <label className="c360-field">CEST{(form.csosn === '500' || form.cstIcms === '60') ? ' (obrigatório com ST)' : ' (só com ST)'}<select className="c360-input" aria-label="CEST" value={soDig(form.cest)} onChange={(e) => set('cest', e.target.value)}>
        <option value="">— sem CEST —</option>
        {cestForaDaLista && <option value={soDig(form.cest)}>{fmtCest(soDig(form.cest))} (fora das opções deste NCM)</option>}
        {cests.map((c) => <option key={c.codigo} value={c.codigo}>{c.formatado} · {c.descricao}</option>)}
      </select>
        {ncm.length === 8 && ncmInfo && !cests.length && <span className="dadm-muted" style={{ fontSize: 12 }}>Este NCM não está no Convênio ICMS 142/2018 (sem CEST).</span>}
        <Nota campo="cest" />
      </label>
    </div>
    <button type="button" className="c360-btn ghost" onClick={() => setVerBuscaNcm((v) => !v)}>{verBuscaNcm ? 'Fechar pesquisa' : 'Pesquisar NCM na tabela oficial'}</button>
    {verBuscaNcm && <BuscaTabela tipo="ncm" rotulo="Pesquisar NCM (descrição ou código)" onEscolher={(n) => { setForm((f) => ({ ...f, ncm: n.codigo, cest: '' })); setVerBuscaNcm(false) }} />}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <label className="c360-field">CFOP (venda)
        {cfopLivre || cfopForaDaLista
          ? <input className="c360-input" aria-label="CFOP" required inputMode="numeric" maxLength={4} value={form.cfop || ''} onChange={(e) => set('cfop', soDig(e.target.value))} />
          : <select className="c360-input" aria-label="CFOP" required value={soDig(form.cfop)} onChange={(e) => (e.target.value === 'outro' ? setCfopLivre(true) : set('cfop', e.target.value))}>
            <option value="">— escolher —</option>
            {cfops.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}
            <option value="outro">Outro CFOP…</option>
          </select>}
        <Nota campo="cfop" />
      </label>
      <label className="c360-field">Origem da mercadoria<select className="c360-input" aria-label="Origem" value={form.origem || '0'} onChange={(e) => set('origem', e.target.value)}>{ORIGENS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select><Nota campo="origem" /></label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {mostrarCsosn && <label className="c360-field">CSOSN (Simples Nacional)<select className="c360-input" aria-label="CSOSN" value={form.csosn || ''} onChange={(e) => set('csosn', e.target.value)}><option value="">—</option>{(refs?.csosn || []).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}</select><Nota campo="csosn" /></label>}
      {mostrarCst && <label className="c360-field">CST do ICMS (regime normal)<select className="c360-input" aria-label="CST do ICMS" value={form.cstIcms || ''} onChange={(e) => set('cstIcms', e.target.value)}><option value="">—</option>{(refs?.cstIcms || []).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}</select><Nota campo="cstIcms" /></label>}
      {mostrarCst && <label className="c360-field">Alíquota do ICMS (%)<input className="c360-input" aria-label="Alíquota do ICMS" inputMode="decimal" value={form.aliquotaIcms ?? ''} onChange={(e) => set('aliquotaIcms', e.target.value)} /></label>}
      {form.cstIcms === '20' && <label className="c360-field">Redução da base (%)<input className="c360-input" aria-label="Redução da base" required inputMode="decimal" value={form.reducaoBaseIcms ?? ''} onChange={(e) => set('reducaoBaseIcms', e.target.value)} /><Nota campo="reducaoBaseIcms" /></label>}
      <label className="c360-field">Unidade tributável<select className="c360-input" aria-label="Unidade tributável" value={(form.unidadeTributavel || 'UN').toUpperCase()} onChange={(e) => set('unidadeTributavel', e.target.value)}>{(refs?.unidades || [{ codigo: 'UN', descricao: 'Unidade' }]).map((u) => <option key={u.codigo} value={u.codigo}>{u.codigo} · {u.descricao}</option>)}</select><Nota campo="unidadeTributavel" /></label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
      <label className="c360-field">CST do PIS<select className="c360-input" aria-label="CST do PIS" value={form.cstPis || ''} onChange={(e) => set('cstPis', e.target.value)}><option value="">—</option>{(refs?.cstPisCofins || []).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}</select><Nota campo="cstPis" /></label>
      <label className="c360-field">PIS (%)<input className="c360-input" aria-label="Alíquota do PIS" inputMode="decimal" value={form.aliquotaPis ?? ''} onChange={(e) => set('aliquotaPis', e.target.value)} /></label>
      <label className="c360-field">CST do COFINS<select className="c360-input" aria-label="CST do COFINS" value={form.cstCofins || ''} onChange={(e) => set('cstCofins', e.target.value)}><option value="">—</option>{(refs?.cstPisCofins || []).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}</select><Nota campo="cstCofins" /></label>
      <label className="c360-field">COFINS (%)<input className="c360-input" aria-label="Alíquota do COFINS" inputMode="decimal" value={form.aliquotaCofins ?? ''} onChange={(e) => set('aliquotaCofins', e.target.value)} /></label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{ibsCbs}</div>
  </div>
}

function ResultadoConferencia({ conferencia, carregando }) {
  if (carregando && !conferencia) return <p className="dadm-muted">Conferindo nas tabelas oficiais…</p>
  if (!conferencia) return null
  const { erros = [], avisos = [] } = conferencia
  if (!erros.length && !avisos.length) return <p className="dadm-note success" role="status">Conferido nas tabelas oficiais: nenhum problema.</p>
  return <div role="status">
    {erros.length > 0 && <p className="dadm-note warn" style={{ borderColor: 'var(--danger, #c0392b)' }}><strong>{erros.length} erro(s) — corrija para salvar:</strong> {erros.map((e) => e.mensagem).join(' ')}</p>}
    {avisos.length > 0 && <p className="dadm-note"><strong>{avisos.length} aviso(s) para o contador conferir:</strong> {avisos.map((e) => e.mensagem).join(' ')}</p>}
  </div>
}

// confere o rascunho no servidor (com o regime do emitente), sem travar a digitação
function useConferencia(rascunho) {
  const [conferencia, setConferencia] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const seq = useRef(0)
  const corpo = useMemo(() => {
    if (!rascunho) return null
    const { sugestoes, ncmSugerido, ...resto } = rascunho
    void sugestoes; void ncmSugerido
    return JSON.stringify(resto)
  }, [rascunho])
  useEffect(() => {
    if (!corpo) { setConferencia(null); return undefined }
    const n = ++seq.current
    setCarregando(true)
    const t = setTimeout(async () => {
      try { const r = await api.post(`${BASE}/classificacoes/conferir`, JSON.parse(corpo)); if (n === seq.current) setConferencia(r) } catch { if (n === seq.current) setConferencia(null) } finally { if (n === seq.current) setCarregando(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [corpo])
  return { conferencia, carregando }
}

export default function ClassificacaoFiscal({ toast }) {
  const [dados, setDados] = useState(null)
  const [refs, setRefs] = useState(null)
  const [perfis, setPerfis] = useState([])
  const prefs = useMemo(lerPreferencias, [])
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState(prefs.situacao || 'todas')
  const [origem, setOrigem] = useState(prefs.origem || 'todas')
  const [tipo, setTipo] = useState(prefs.tipo || 'todos')
  const [ordem, setOrdem] = useState(prefs.ordem || 'situacao')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [form, setForm] = useState(null)
  const [emLote, setEmLote] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [planilha, setPlanilha] = useState({ arquivo: null, previa: null })
  const [enviando, setEnviando] = useState(false)
  const conf = useConferencia(form)
  const confLote = useConferencia(emLote)

  const carregar = useCallback(() => api.get(`${BASE}/classificacoes/analise`).then((r) => setDados(r && Array.isArray(r.itens) ? r : { itens: [], resumo: {} })).catch((e) => toast(e.message, 'error')), [toast])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    api.get(`${BASE}/classificacoes/referencias`).then(setRefs).catch(() => setRefs(null))
    api.get(`${BASE}/classificacoes/perfis`).then((p) => setPerfis(Array.isArray(p) ? p : [])).catch(() => setPerfis([]))
  }, [])
  useEffect(() => { gravarPreferencias({ situacao, origem, tipo, ordem }); setLimite(POR_PAGINA) }, [situacao, origem, tipo, ordem, busca])

  const itens = useMemo(() => dados?.itens || [], [dados])
  const origens = useMemo(() => [...new Set(itens.map((i) => i.origemRotulo))].sort(), [itens])
  const filtrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    const r = itens.filter((i) => (!termos.length || termos.every((t) => (i.busca || normalizar(`${i.nome} ${i.grupo}`)).includes(t)))
      && (situacao === 'todas' || (situacao === 'herdadas' ? i.herdada : situacao === 'orfas' ? i.orfa : i.situacao === situacao))
      && (origem === 'todas' || i.origemRotulo === origem)
      && (tipo === 'todos' || i.tipo === tipo))
    const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    return r.sort(ordem === 'nome' ? porNome : ordem === 'origem' ? (a, b) => String(a.grupo).localeCompare(String(b.grupo), 'pt-BR') || porNome(a, b) : (a, b) => (ORDEM_SITUACAO[a.situacao] ?? 9) - (ORDEM_SITUACAO[b.situacao] ?? 9) || porNome(a, b))
  }, [itens, busca, situacao, origem, tipo, ordem])
  const visiveis = filtrados.slice(0, limite)
  const resumo = dados?.resumo || {}
  const contagem = { todas: resumo.total, sem: resumo.sem, erro: resumo.erro, aviso: resumo.aviso, ok: resumo.ok, herdadas: resumo.herdadas, orfas: resumo.orfas }
  const selecionaveis = visiveis.filter((i) => i.tipo !== 'servico' && i.fonte !== 'categoria')
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((i) => selecionados.has(chaveItem(i)))
  const alternar = (i) => setSelecionados((atual) => { const n = new Set(atual); if (n.has(chaveItem(i))) n.delete(chaveItem(i)); else n.add(chaveItem(i)); return n })
  const alternarTodos = () => setSelecionados(todosMarcados ? new Set() : new Set(selecionaveis.map(chaveItem)))
  const filtrosAtivos = busca || situacao !== 'todas' || origem !== 'todas' || tipo !== 'todos'

  const abrir = (i) => setForm({
    fonte: i.fonte, fonteId: i.fonteId, tipo: i.tipo || 'produto', nomeItem: i.nome,
    ...VAZIO, ...(i.herdada ? {} : limpar(i.classificacao)),
    ...(!i.classificacao && i.sugestoes?.[0]?.valido && i.sugestoes[0].origem === 'cadastro' ? { ncm: i.sugestoes[0].ncm } : {}),
    sugestoes: i.classificacao ? [] : (i.sugestoes || []),
  })
  async function salvar() {
    if (enviando || conf.conferencia?.erros?.length) return
    const { sugestoes, nomeItem, ...corpo } = form
    void sugestoes; void nomeItem
    setEnviando(true)
    try { await api.put(`${BASE}/classificacoes`, corpo); toast('Classificação salva.', 'success'); setForm(null); carregar() } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function salvarLote() {
    if (enviando || confLote.conferencia?.erros?.length) return
    setEnviando(true)
    const lista = itens.filter((i) => selecionados.has(chaveItem(i))).map((i) => ({ fonte: i.fonte, fonteId: i.fonteId }))
    try {
      const r = await api.post(`${BASE}/classificacoes/lote`, { itens: lista, classificacao: emLote })
      toast(`${r.aplicadas} item(ns) classificado(s).`, 'success'); setEmLote(null); setSelecionados(new Set()); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function baixarPlanilha() {
    try {
      const blob = await api.blob(`${BASE}/classificacoes/planilha`)
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = 'classificacao-fiscal.csv'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast(error.message, 'error') }
  }
  async function importarPlanilha(aplicar) {
    if (!planilha.arquivo || enviando) return
    setEnviando(true)
    try {
      const r = await api.upload(`${BASE}/classificacoes/planilha${aplicar ? '?aplicar=1' : ''}`, planilha.arquivo)
      if (aplicar) { toast(`Planilha aplicada: ${r.aplicadas} item(ns) classificado(s)${r.erros?.length ? `; ${r.erros.length} linha(s) com erro` : ''}.`, r.erros?.length ? 'error' : 'success'); setPlanilha({ arquivo: null, previa: r }); carregar() }
      else setPlanilha({ ...planilha, previa: r })
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const pedirExclusao = (i) => setConfirmar({
    titulo: 'Excluir classificação',
    texto: `Excluir a classificação de "${i.nome}"? ${i.fonte === 'bar_produto' ? 'Volta a valer a da categoria, se houver.' : 'O item fica sem classificação até classificar de novo.'}`,
    acao: async () => {
      try { await api.delete(`${BASE}/classificacoes?fonte=${encodeURIComponent(i.fonte)}&fonteId=${encodeURIComponent(i.fonteId)}`); toast('Classificação excluída.', 'success'); carregar() } catch (error) { toast(error.message, 'error') }
    },
  })

  const fontes = dados?.fontes
  return <section className="dadm-card">
    <h2>Classificação fiscal</h2>
    <p className="dadm-muted">Pesquise por nome, SKU, NCM, CEST, CFOP, CSOSN/CST, cTribNac ou pela descrição oficial do código. Cada classificação é conferida nas tabelas oficiais; o que tem erro não é gravado.{dados?.regime ? ` Regime do emitente: ${dados.regime === 'simples' ? 'Simples Nacional (CSOSN)' : 'normal (CST)'}.` : ''}</p>
    <div role="group" aria-label="Situação" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {SITUACOES.map(([v, r]) => <button key={v} type="button" aria-pressed={situacao === v} className={`c360-btn ${situacao === v ? 'primary' : 'ghost'}`} onClick={() => setSituacao(v)}>{r}{contagem[v] !== undefined ? ` (${contagem[v] || 0})` : ''}</button>)}
    </div>
    <div className="dadm-filters">
      <input className="c360-input" type="search" style={{ minWidth: 280, flex: '2 1 280px' }} placeholder="Buscar: nome, SKU, NCM, CEST, CFOP, CSOSN, cTribNac, descrição" aria-label="Buscar na classificação" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <select className="c360-input" aria-label="Origem do item" value={origem} onChange={(e) => setOrigem(e.target.value)}><option value="todas">Todas as origens</option>{origens.map((o) => <option key={o} value={o}>{o} ({itens.filter((i) => i.origemRotulo === o).length})</option>)}</select>
      <select className="c360-input" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="todos">Produtos e serviços</option><option value="produto">Só produtos</option><option value="servico">Só serviços</option></select>
      <select className="c360-input" aria-label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value)}><option value="situacao">Ordem: problemas primeiro</option><option value="nome">Ordem: nome</option><option value="origem">Ordem: origem</option></select>
      {filtrosAtivos && <button type="button" className="c360-btn ghost" onClick={() => { setBusca(''); setSituacao('todas'); setOrigem('todas'); setTipo('todos') }}>Limpar filtros</button>}
    </div>
    <div className="dadm-actions" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
      <button type="button" className="c360-btn primary" disabled={!selecionados.size} onClick={() => setEmLote({ tipo: 'produto', ...VAZIO })}>Classificar selecionados ({selecionados.size})</button>
      {selecionados.size > 0 && <button type="button" className="c360-btn ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</button>}
      <button type="button" className="c360-btn ghost" onClick={() => setForm({ fonte: 'categoria', fonteId: 'bar:', tipo: 'produto', ...VAZIO, sugestoes: [] })}>Padrão de categoria do bar</button>
      <button type="button" className="c360-btn ghost" onClick={() => setForm({ fonte: 'servico', fonteId: '', tipo: 'servico', ...VAZIO, sugestoes: [] })}>+ Serviço (NFS-e)</button>
    </div>
    {!dados ? <p className="dadm-muted">Carregando…</p> : <>
      <p className="dadm-muted" aria-live="polite">Mostrando {visiveis.length} de {filtrados.length}{filtrados.length !== itens.length ? ` (de ${itens.length} no total)` : ''}.</p>
      <Table caption="Produtos e classificação" rows={visiveis.map((i) => ({ ...i, id: chaveItem(i) }))} empty={filtrosAtivos ? 'Nenhum item com esses filtros.' : 'Nada para classificar.'} columns={[
        { key: 'sel', label: <input type="checkbox" aria-label="Marcar todos os visíveis" checked={todosMarcados} onChange={alternarTodos} />, render: (i) => (i.tipo !== 'servico' && i.fonte !== 'categoria' ? <input type="checkbox" aria-label={`Marcar ${i.nome}`} checked={selecionados.has(chaveItem(i))} onChange={() => alternar(i)} /> : null) },
        { key: 'nome', label: 'Produto / serviço', render: (i) => <div>
          <strong>{ROTULO_CATEGORIA[i.fonteId] || i.nome}</strong>
          <div className="dadm-muted">{i.grupo}{i.herdada ? ' · usa o padrão da categoria' : ''}</div>
          {!i.classificacao && (i.sugestoes || []).map((s, k) => <div key={k} className="dadm-muted" style={{ fontSize: 12 }}>{s.origem === 'cadastro' ? 'NCM do cadastro' : 'Sugestão'}: {fmtNcm(s.ncm)}{s.cest ? ` / CEST ${fmtCest(s.cest)}` : ''} — {s.descricao || 'inexistente na tabela'}{s.valido ? '' : ' ⚠'}</div>)}
        </div> },
        { key: 'cls', label: 'Classificação', render: (i) => (i.classificacao ? <div>
          <div>{resumoCodigos({ ...i.classificacao, tipo: i.tipo })}</div>
          {i.descricao && <div className="dadm-muted" style={{ fontSize: 12 }}>{[i.descricao.ncmCaminho || i.descricao.ncm, i.descricao.cest && `CEST: ${i.descricao.cest}`, i.descricao.servico].filter(Boolean).join(' · ')}</div>}
        </div> : <span className="dadm-muted">sem classificação</span>) },
        { key: 'sit', label: 'Situação', render: (i) => <div style={{ maxWidth: 340 }}>
          <Badge tone={TOM[i.situacao] || 'muted'}>{ROTULO_SITUACAO[i.situacao] || i.situacao}</Badge>
          {i.orfa && <> <Badge tone="warning">sem cadastro</Badge></>}
          {[...(i.erros || []), ...(i.avisos || [])].slice(0, 2).map((m, k) => <div key={k} style={{ fontSize: 12, color: k < (i.erros || []).length ? 'var(--danger, #c0392b)' : undefined }} className={k < (i.erros || []).length ? '' : 'dadm-muted'}>{m.mensagem}</div>)}
          {(i.erros?.length || 0) + (i.avisos?.length || 0) > 2 && <div className="dadm-muted" style={{ fontSize: 12 }}>+{(i.erros.length + i.avisos.length) - 2} na edição</div>}
        </div> },
        { key: 'a', label: '', render: (i) => <div className="dadm-actions">
          <button type="button" className="c360-btn ghost" onClick={() => abrir(i)}>{i.classificacao && !i.herdada ? 'Editar' : 'Classificar'}</button>
          {i.classificacao && !i.herdada && <button type="button" className="c360-btn ghost" onClick={() => pedirExclusao(i)}>Excluir</button>}
        </div> },
      ]} />
      {filtrados.length > visiveis.length && <button type="button" className="c360-btn ghost" onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais ({filtrados.length - visiveis.length})</button>}
    </>}
    <section className="dadm-card" style={{ marginTop: 16 }}>
      <h3>Planilha</h3>
      <p className="dadm-muted">Baixe a planilha com todos os itens (e as sugestões de NCM/CEST), preencha no Excel e importe. Primeiro sai a prévia, sem gravar nada; depois aplique. Linhas sem NCM ficam como estão. Depois de aplicar, use o filtro "Com erro" para conferir o que veio da planilha.</p>
      <div className="dadm-filters">
        <button type="button" className="c360-btn ghost" onClick={baixarPlanilha}>Baixar planilha</button>
        <input type="file" accept=".csv,text/csv" aria-label="Planilha de classificação (CSV)" onChange={(e) => setPlanilha({ arquivo: e.target.files?.[0] || null, previa: null })} />
        <button type="button" className="c360-btn ghost" disabled={!planilha.arquivo || enviando} onClick={() => importarPlanilha(false)}>Ver prévia</button>
        <button type="button" className="c360-btn primary" disabled={!planilha.arquivo || !planilha.previa || planilha.previa.prevista === false || !planilha.previa.validas || enviando} onClick={() => importarPlanilha(true)}>Aplicar planilha</button>
      </div>
      {planilha.previa && <div role="status">
        <p className={`dadm-note ${planilha.previa.erros?.length ? 'warn' : 'success'}`}>{planilha.previa.prevista ? 'Prévia' : 'Aplicada'}: {planilha.previa.linhas} linha(s), {planilha.previa.prevista ? `${planilha.previa.validas} válida(s)` : `${planilha.previa.aplicadas} gravada(s)`}, {planilha.previa.ignoradas} sem NCM (ignoradas){planilha.previa.erros?.length ? `, ${planilha.previa.erros.length} com erro` : ''}.</p>
        {planilha.previa.erros?.length > 0 && <Table caption="Linhas com erro" rows={planilha.previa.erros.map((e) => ({ ...e, id: `l${e.linha}` }))} columns={[
          { key: 'l', label: 'Linha', render: (e) => e.linha }, { key: 'i', label: 'Item', render: (e) => e.item }, { key: 'm', label: 'Erro', render: (e) => e.mensagem },
        ]} />}
      </div>}
    </section>
    {fontes && <p className="dadm-muted" style={{ fontSize: 12, marginTop: 12 }}>Tabelas: NCM {fontes.ncm?.vigencia} ({fontes.ncm?.ato}); CEST do Convênio ICMS 142/2018 (captura de {fontes.cest?.obtidoEm}); Lista de Serviços Nacional da NFS-e (Anexo B v1.01). Confirme a tributação com o contador.</p>}
    <Dialog open={Boolean(form)} title={form?.nomeItem ? `Classificação fiscal · ${form.nomeItem}` : 'Classificação fiscal'} labelId="fis-cls" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando || Boolean(conf.conferencia?.erros?.length)}>{enviando ? 'Salvando…' : 'Salvar'}</button></>}>
      {form && <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>
        {form.fonte === 'categoria' && (ROTULO_CATEGORIA[form.fonteId]
          ? <p className="dadm-muted"><strong>{ROTULO_CATEGORIA[form.fonteId]}</strong></p>
          : <label className="c360-field">Categoria do bar (como no cardápio)<input className="c360-input" aria-label="Categoria do bar" required value={String(form.fonteId).replace(/^bar:/, '')} onChange={(e) => setForm((f) => ({ ...f, fonteId: `bar:${e.target.value}` }))} /></label>)}
        {form.fonte === 'servico' && !form.nomeItem && <label className="c360-field">Código interno do serviço<input className="c360-input" aria-label="Código interno do serviço" required value={form.fonteId} onChange={(e) => setForm((f) => ({ ...f, fonteId: e.target.value }))} placeholder="ex.: aula-tenis" /></label>}
        <FormularioClassificacao form={form} setForm={setForm} refs={refs} regime={dados?.regime} perfis={perfis} conferencia={conf.conferencia} />
        <ResultadoConferencia conferencia={conf.conferencia} carregando={conf.carregando} />
      </div>}
    </Dialog>
    <Dialog open={Boolean(emLote)} title={`Classificar ${selecionados.size} item(ns) de uma vez`} labelId="fis-cls-lote" onClose={() => setEmLote(null)} onSubmit={salvarLote}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setEmLote(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando || Boolean(confLote.conferencia?.erros?.length)}>Aplicar a {selecionados.size}</button></>}>
      {emLote && <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>
        <p className="dadm-note warn">A mesma classificação vai para todos os itens marcados e substitui a que eles já tiverem. Se algum item der erro, nenhum é gravado.</p>
        <FormularioClassificacao form={emLote} setForm={setEmLote} refs={refs} regime={dados?.regime} perfis={perfis} conferencia={confLote.conferencia} />
        <ResultadoConferencia conferencia={confLote.conferencia} carregando={confLote.carregando} />
      </div>}
    </Dialog>
    <Dialog open={Boolean(confirmar)} title={confirmar?.titulo || ''} labelId="fis-cls-conf" onClose={() => setConfirmar(null)} danger
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setConfirmar(null)}>Voltar</button><button type="button" className="c360-btn primary" onClick={async () => { const a = confirmar.acao; setConfirmar(null); await a() }}>Confirmar</button></>}>
      <p>{confirmar?.texto}</p>
    </Dialog>
  </section>
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { useToast } from '../../../hooks/useToast'
import { useAuth } from '../../../lib/auth'
import { lojasDaEmpresa } from '../../../lib/context-selection'
import { Badge, Dialog, Table } from '../customer360/shared'
import { money, dateTime } from '../dino/format'
import '../customer360.css'
import '../dino/dino-admin.css'

// Fiscal da empresa — SOMENTE HOMOLOGAÇÃO: emitente, certificado A1, tabela IBPT, classificação dos
// produtos, documentos (NFC-e, NF-e, NFS-e, com DANFE e contingência offline da NFC-e) e
// inutilização de numeração. Nada aqui tem valor fiscal até a produção ser liberada.
const BASE = '/api/admin/fiscal'
const ABAS = [['situacao', 'Emitente e certificado'], ['classificacao', 'Classificação'], ['documentos', 'Documentos'], ['inutilizacao', 'Inutilização']]
const STATUS = {
  rascunho: ['Rascunho', 'muted'], enviando: ['Enviando', 'info'], autorizado: ['Autorizado (homologação)', 'success'], rejeitado: ['Rejeitado', 'danger'],
  falha_comunicacao: ['Falha de comunicação', 'warning'], validado_localmente: ['XML validado (não enviado)', 'info'], cancelado: ['Cancelado', 'muted'],
  contingencia: ['Contingência offline (a transmitir)', 'warning'],
}
const STATUS_INUT = {
  validado_localmente: ['Bloqueada aqui (não enviada)', 'info'], enviando: ['Enviando', 'info'], homologada: ['Homologada (homologação)', 'success'],
  rejeitada: ['Rejeitada', 'danger'], falha_comunicacao: ['Falha de comunicação', 'warning'],
}
const MODELO = { 65: 'NFC-e', 55: 'NF-e', nfse: 'NFS-e' }
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const chave = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const lerBase64 = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',').pop()); r.onerror = falha; r.readAsDataURL(file) })

export default function Fiscal({ abaInicial = 'situacao' }) {
  const { toast } = useToast()
  const { empresaAtiva } = useAuth()
  const [aba, setAba] = useState(abaInicial)
  const [estado, setEstado] = useState(null)
  const carregarEstado = useCallback(() => api.get(`${BASE}/estado`).then(setEstado).catch(() => setEstado(null)), [])
  useEffect(() => { carregarEstado() }, [carregarEstado, empresaAtiva?.id])

  return <div className="dadm-page">
    <header className="dadm-head">
      <div><div className="dadm-eyebrow">Fiscal · {empresaAtiva?.nome || 'Empresa'}</div><h1>Notas fiscais</h1>
        <p>NFC-e, NF-e e NFS-e emitidas com o certificado da própria empresa.</p></div>
    </header>
    <p className="dadm-note warn" role="status"><strong>Ambiente de homologação.</strong> As notas daqui são de teste e não têm valor fiscal{estado?.transmissao === 'homologacao' ? '; elas são enviadas à SEFAZ de homologação.' : '. O XML é montado, assinado e validado, mas o envio à SEFAZ está desligado neste servidor.'}</p>
    {estado && !estado.pronto && <p className="dadm-note danger">Falta para emitir: {estado.pendencias.join(' · ')}.</p>}
    <div className="dadm-tabs" role="tablist" aria-label="Seções do fiscal">
      {ABAS.map(([id, rotulo]) => <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}
    </div>
    {aba === 'situacao' && <Situacao toast={toast} onMudou={carregarEstado} />}
    {aba === 'classificacao' && <Classificacao toast={toast} />}
    {aba === 'documentos' && <Documentos toast={toast} />}
    {aba === 'inutilizacao' && <Inutilizacao toast={toast} />}
  </div>
}

function Situacao({ toast, onMudou }) {
  const { empresaAtiva, lojasAcessiveis } = useAuth()
  const lojas = useMemo(() => lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id), [lojasAcessiveis, empresaAtiva?.id])
  const [emitentes, setEmitentes] = useState([])
  const [certs, setCerts] = useState([])
  const [form, setForm] = useState(null)
  const [cert, setCert] = useState({ arquivo: null, senha: '' })
  const [ibpt, setIbpt] = useState([])
  const [arqIbpt, setArqIbpt] = useState({ arquivo: null, uf: '' })
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(async () => {
    try { const [e, c, t] = await Promise.all([api.get(`${BASE}/emitentes`), api.get(`${BASE}/certificados`), api.get(`${BASE}/ibpt`)]); setEmitentes(e); setCerts(c); setIbpt(Array.isArray(t) ? t : []) } catch (error) { toast(error.message, 'error') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  const novo = (e = {}) => setForm({ lojaId: e.lojaId || '', cnpj: e.cnpj || '', razaoSocial: e.razaoSocial || '', nomeFantasia: e.nomeFantasia || '', ie: e.ie || '', im: e.im || '', crt: e.crt || '1', uf: e.uf || 'MT', codigoMunicipio: e.codigoMunicipio || '', endereco: { logradouro: '', numero: '', bairro: '', cidade: '', cep: '', ...(e.endereco || {}) }, cscId: e.cscId || '', csc: '', cscConfigurado: e.cscConfigurado, cTribNacPadrao: e.cTribNacPadrao || '' })
  async function salvar() {
    if (enviando) return
    setEnviando(true)
    try { await api.put(`${BASE}/emitentes`, { ...form, lojaId: form.lojaId || null }); toast('Emitente salvo.', 'success'); setForm(null); carregar(); onMudou() } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function enviarCertificado(ev) {
    ev.preventDefault()
    if (!cert.arquivo || enviando) return
    setEnviando(true)
    try { await api.post(`${BASE}/certificados`, { arquivoBase64: await lerBase64(cert.arquivo), senha: cert.senha }); toast('Certificado guardado no cofre.', 'success'); setCert({ arquivo: null, senha: '' }); carregar(); onMudou() } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  async function enviarIbpt(ev) {
    ev.preventDefault()
    if (!arqIbpt.arquivo || enviando) return
    setEnviando(true)
    try {
      // o CSV vai cru (pode passar de 2 MB): a API lê UTF-8 ou Latin-1
      const r = await api.upload(`${BASE}/ibpt${arqIbpt.uf ? `?uf=${arqIbpt.uf}` : ''}`, arqIbpt.arquivo)
      toast(`Tabela do IBPT ${r.uf} importada: ${r.importadas} códigos${r.ignoradas ? ` (${r.ignoradas} linhas ignoradas)` : ''}.`, 'success')
      setArqIbpt({ arquivo: null, uf: '' }); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const campo = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></label>
  const campoEnd = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form.endereco[k] || ''} onChange={(e) => setForm({ ...form, endereco: { ...form.endereco, [k]: e.target.value } })} {...extra} /></label>
  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>Emitente</h2>
      <Table caption="Emitentes" rows={emitentes} empty="Nenhum emitente. Cadastre o CNPJ da empresa (e de cada unidade com CNPJ próprio)." columns={[
        { key: 'quem', label: 'Emitente', render: (e) => <div><strong>{e.razaoSocial}</strong><div className="dadm-muted">CNPJ {e.cnpj} · {e.lojaId ? lojas.find((l) => l.id === e.lojaId)?.nome || 'Unidade' : 'Empresa toda'} · {e.uf}</div></div> },
        { key: 'ie', label: 'IE / IM', render: (e) => `${e.ie || '—'} / ${e.im || '—'}` },
        { key: 'csc', label: 'CSC', render: (e) => (e.cscConfigurado ? <Badge tone="success">guardado</Badge> : <Badge tone="warning">falta</Badge>) },
        { key: 'acao', label: '', render: (e) => <button type="button" className="c360-btn ghost" onClick={() => novo(e)}>Editar</button> },
      ]} />
      <div className="dadm-actions"><button type="button" className="c360-btn primary" onClick={() => novo()}>+ Emitente</button></div>
    </section>
    <section className="dadm-card">
      <h2>Certificado A1</h2>
      <p className="dadm-muted">O arquivo e a senha ficam cifrados no cofre do servidor. Ninguém consegue baixá-los de volta pela tela.</p>
      <Table caption="Certificados" rows={certs} empty="Nenhum certificado enviado." columns={[
        { key: 't', label: 'Titular', render: (c) => <div><strong>{c.titular}</strong>{c.cnpj && <div className="dadm-muted">CNPJ {c.cnpj}</div>}</div> },
        { key: 'v', label: 'Válido até', render: (c) => <span className={new Date(c.validoAte) < new Date(Date.now() + 30 * 864e5) ? 'dadm-neg' : ''}>{dateTime(c.validoAte)}</span> },
        { key: 'a', label: 'Situação', render: (c) => (c.ativo ? <Badge tone="success">em uso</Badge> : <Badge tone="muted">substituído</Badge>) },
      ]} />
      <form className="dadm-filters" onSubmit={enviarCertificado}>
        <input type="file" accept=".pfx,.p12" aria-label="Arquivo do certificado A1" onChange={(e) => setCert({ ...cert, arquivo: e.target.files?.[0] || null })} />
        <input className="c360-input" type="password" autoComplete="off" placeholder="Senha do certificado" aria-label="Senha do certificado" value={cert.senha} onChange={(e) => setCert({ ...cert, senha: e.target.value })} />
        <button type="submit" className="c360-btn primary" disabled={!cert.arquivo || enviando}>Enviar certificado</button>
      </form>
    </section>
    <section className="dadm-card">
      <h2>Tributos aproximados (IBPT)</h2>
      <p className="dadm-muted">Lei 12.741/2012: com a tabela do IBPT da UF importada, a nota e o DANFE trazem o valor aproximado dos tributos (vTotTrib). Sem tabela, o campo fica de fora. Baixe o CSV oficial no site do IBPT (De Olho no Imposto).</p>
      <Table caption="Tabelas do IBPT" rows={ibpt.map((t) => ({ ...t, id: t.uf }))} empty="Nenhuma tabela do IBPT importada." columns={[
        { key: 'uf', label: 'UF', render: (t) => <strong>{t.uf}</strong> },
        { key: 'v', label: 'Versão', render: (t) => t.versao || '—' },
        { key: 'l', label: 'Códigos', align: 'right', render: (t) => t.linhas },
        { key: 'vig', label: 'Vigência até', render: (t) => (t.vigenciaFim ? <span className={new Date(t.vigenciaFim) < new Date() ? 'dadm-neg' : ''}>{dateTime(t.vigenciaFim)}</span> : '—') },
      ]} />
      <form className="dadm-filters" onSubmit={enviarIbpt}>
        <input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV do IBPT" onChange={(e) => setArqIbpt({ ...arqIbpt, arquivo: e.target.files?.[0] || null })} />
        <select className="c360-input" aria-label="UF da tabela do IBPT" value={arqIbpt.uf} onChange={(e) => setArqIbpt({ ...arqIbpt, uf: e.target.value })}><option value="">UF do emitente</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        <button type="submit" className="c360-btn primary" disabled={!arqIbpt.arquivo || enviando}>Importar tabela do IBPT</button>
      </form>
    </section>
    <Dialog open={Boolean(form)} title="Emitente" labelId="fis-emit" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={enviando}>Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Vale para<select className="c360-input" value={form.lojaId} onChange={(e) => setForm({ ...form, lojaId: e.target.value })}><option value="">Empresa toda</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome} (CNPJ próprio)</option>)}</select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>{campo('CNPJ', 'cnpj', { required: true, inputMode: 'numeric' })}{campo('Razão social', 'razaoSocial', { required: true })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>{campo('Nome fantasia', 'nomeFantasia')}{campo('Inscrição estadual', 'ie')}{campo('Inscrição municipal', 'im')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">Regime (CRT)<select className="c360-input" value={form.crt} onChange={(e) => setForm({ ...form, crt: e.target.value })}><option value="1">1 · Simples Nacional</option><option value="4">4 · MEI</option><option value="2">2 · Simples (excesso de sublimite)</option><option value="3">3 · Regime normal</option></select></label>
          <label className="c360-field">UF<select className="c360-input" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
          {campo('Município (IBGE)', 'codigoMunicipio', { required: true, inputMode: 'numeric', maxLength: 7 })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr', gap: 10 }}>{campoEnd('Logradouro', 'logradouro')}{campoEnd('Número', 'numero')}{campoEnd('Bairro', 'bairro')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>{campoEnd('Cidade', 'cidade')}{campoEnd('CEP', 'cep', { inputMode: 'numeric' })}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
          {campo('ID do CSC', 'cscId')}
          {campo(form.cscConfigurado ? 'CSC de homologação (vazio mantém o atual)' : 'CSC de homologação', 'csc', { type: 'password', autoComplete: 'off' })}
          {campo('cTribNac padrão (NFS-e)', 'cTribNacPadrao', { inputMode: 'numeric', maxLength: 6 })}
        </div>
      </div>}
    </Dialog>
  </div>
}

const VAZIO = { ncm: '', cfop: '5102', csosn: '102', cstIcms: '', aliquotaIcms: '', cest: '', origem: '0', cTribNac: '' }

function Classificacao({ toast }) {
  const [lista, setLista] = useState([])
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(null)
  const carregar = useCallback(() => api.get(`${BASE}/classificacoes`).then(setLista).catch((e) => toast(e.message, 'error')), [toast])
  useEffect(() => { carregar() }, [carregar])
  const visiveis = lista.filter((i) => !busca || `${i.nome} ${i.grupo}`.toLowerCase().includes(busca.toLowerCase()))
  const semClassificacao = lista.filter((i) => !i.classificacao).length
  async function salvar() {
    const { ncmSugerido, ...corpo } = form
    void ncmSugerido
    try { await api.put(`${BASE}/classificacoes`, corpo); toast('Classificação salva.', 'success'); setForm(null); carregar() } catch (error) { toast(error.message, 'error') }
  }
  return <section className="dadm-card">
    <h2>Classificação fiscal</h2>
    <p className="dadm-muted">NCM, CFOP e CSOSN/CST de cada produto vendido (bar, loja online e itens do estoque). No bar, dá para classificar a categoria inteira de uma vez (ex.: Bebidas) e só ajustar as exceções. Nos itens do estoque, o NCM do cadastro vem como sugestão. {semClassificacao ? <strong>{semClassificacao} sem classificação.</strong> : null}</p>
    <div className="dadm-filters">
      <input className="c360-input" type="search" placeholder="Buscar produto" aria-label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <button type="button" className="c360-btn ghost" onClick={() => setForm({ fonte: 'categoria', fonteId: 'bar:', tipo: 'produto', ...VAZIO })}>Padrão de categoria do bar</button>
      <button type="button" className="c360-btn ghost" onClick={() => setForm({ fonte: 'servico', fonteId: '', tipo: 'servico', ...VAZIO })}>+ Serviço (NFS-e)</button>
    </div>
    <Table caption="Produtos e classificação" rows={visiveis.map((i) => ({ ...i, id: `${i.fonte}:${i.fonteId}` }))} empty="Nada para classificar." columns={[
      { key: 'nome', label: 'Produto / serviço', render: (i) => <div><strong>{i.nome}</strong><div className="dadm-muted">{i.grupo}{i.ncmSugerido && !i.classificacao ? ` · NCM do cadastro ${i.ncmSugerido}` : ''}</div></div> },
      { key: 'cls', label: 'Classificação', render: (i) => (i.classificacao ? `${i.classificacao.tipo === 'servico' ? `cTribNac ${i.classificacao.cTribNac}` : `NCM ${i.classificacao.ncm} · CFOP ${i.classificacao.cfop} · ${i.classificacao.csosn ? `CSOSN ${i.classificacao.csosn}` : `CST ${i.classificacao.cstIcms}`}`}${i.herdada ? ' (da categoria)' : ''}` : <Badge tone="warning">sem classificação</Badge>) },
      { key: 'a', label: '', render: (i) => <button type="button" className="c360-btn ghost" onClick={() => setForm({ fonte: i.fonte, fonteId: i.fonteId, tipo: i.classificacao?.tipo || 'produto', ...VAZIO, ...(i.ncmSugerido ? { ncm: i.ncmSugerido } : {}), ...(i.herdada ? {} : i.classificacao || {}), ncmSugerido: i.ncmSugerido || null })}>Classificar</button> },
    ]} />
    <Dialog open={Boolean(form)} title="Classificação fiscal" labelId="fis-cls" onClose={() => setForm(null)} onSubmit={salvar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setForm(null)}>Voltar</button><button type="submit" className="c360-btn primary">Salvar</button></>}>
      {form && <div style={{ display: 'grid', gap: 10 }}>
        {form.fonte === 'categoria' && <label className="c360-field">Categoria do bar (como no cardápio)<input className="c360-input" required value={form.fonteId.replace(/^bar:/, '')} onChange={(e) => setForm({ ...form, fonteId: `bar:${e.target.value}` })} /></label>}
        {form.fonte === 'servico' && <label className="c360-field">Código interno do serviço<input className="c360-input" required value={form.fonteId} onChange={(e) => setForm({ ...form, fonteId: e.target.value })} placeholder="ex.: aula-tenis" /></label>}
        {form.tipo === 'servico' ? <label className="c360-field">Código de tributação nacional (cTribNac, 6 dígitos)<input className="c360-input" required inputMode="numeric" maxLength={6} value={form.cTribNac || ''} onChange={(e) => setForm({ ...form, cTribNac: e.target.value })} /></label>
          : <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label className="c360-field">NCM{form.ncmSugerido ? ` (cadastro do estoque: ${form.ncmSugerido})` : ''}<input className="c360-input" required inputMode="numeric" maxLength={8} value={form.ncm || ''} onChange={(e) => setForm({ ...form, ncm: e.target.value })} /></label>
              <label className="c360-field">CFOP<input className="c360-input" required inputMode="numeric" maxLength={4} value={form.cfop || ''} onChange={(e) => setForm({ ...form, cfop: e.target.value })} /></label>
              <label className="c360-field">CEST (se houver ST)<input className="c360-input" inputMode="numeric" maxLength={7} value={form.cest || ''} onChange={(e) => setForm({ ...form, cest: e.target.value })} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label className="c360-field">CSOSN (Simples)<select className="c360-input" value={form.csosn || ''} onChange={(e) => setForm({ ...form, csosn: e.target.value })}><option value="">—</option><option value="102">102 · sem crédito</option><option value="103">103 · isenção</option><option value="300">300 · imune</option><option value="400">400 · não tributada</option></select></label>
              <label className="c360-field">CST ICMS (regime normal)<select className="c360-input" value={form.cstIcms || ''} onChange={(e) => setForm({ ...form, cstIcms: e.target.value })}><option value="">—</option><option value="00">00 · tributada</option><option value="40">40 · isenta</option><option value="41">41 · não tributada</option></select></label>
              <label className="c360-field">Alíquota ICMS (%)<input className="c360-input" inputMode="decimal" value={form.aliquotaIcms ?? ''} onChange={(e) => setForm({ ...form, aliquotaIcms: e.target.value })} /></label>
            </div>
            <p className="dadm-muted">Confirme com o contador. Esta versão emite CSOSN 102/103/300/400 e CST 00/40/41; substituição tributária fica para depois.</p>
          </>}
      </div>}
    </Dialog>
  </section>
}

function Documentos({ toast }) {
  const [docs, setDocs] = useState([])
  const [vendas, setVendas] = useState([])
  const [cancelando, setCancelando] = useState(null)
  const [nfse, setNfse] = useState(null)
  const [nfeAvulsa, setNfeAvulsa] = useState(null)
  const [enviando, setEnviando] = useState('')
  const [contingenciaAuto, setContingenciaAuto] = useState(false)
  const carregar = useCallback(async () => {
    try { const [d, v] = await Promise.all([api.get(`${BASE}/documentos`), api.get(`${BASE}/vendas-sem-nota`)]); setDocs(d); setVendas(v) } catch (error) { toast(error.message, 'error') }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  async function emitir(corpo, rotulo) {
    if (enviando) return
    setEnviando(rotulo)
    try { const d = await api.post(`${BASE}/documentos`, corpo); toast(`${MODELO[d.modelo]} ${d.numero}: ${STATUS[d.status]?.[0] || d.status}.`, d.status === 'rejeitado' ? 'error' : 'success'); setNfse(null); setNfeAvulsa(null); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function baixarXml(d) {
    try {
      const c = await api.get(`${BASE}/documentos/${d.id}?xml=1`)
      const url = URL.createObjectURL(new Blob([c.xmlAutorizado || c.xmlAssinado || ''], { type: 'application/xml' }))
      const a = document.createElement('a'); a.href = url; a.download = `${MODELO[d.modelo].toLowerCase().replace('-', '')}-${d.serie}-${d.numero}-homologacao.xml`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast(error.message, 'error') }
  }
  async function imprimirDanfe(d) {
    // abre a aba já no clique (senão o navegador bloqueia) e carrega o DANFE autenticado nela
    const janela = typeof window.open === 'function' ? window.open('', '_blank') : null
    try {
      const html = await api.blob(`${BASE}/documentos/${d.id}/danfe`)
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      if (janela) janela.location.href = url
      else { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click() }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { if (janela) janela.close(); toast(error.message, 'error') }
  }
  async function emContingencia(d) {
    if (enviando) return
    setEnviando(d.id)
    try { await api.post(`${BASE}/documentos/${d.id}/contingencia`, {}); toast(`NFC-e ${d.numero} em contingência offline: transmita em até 24 horas.`, 'success'); carregar() }
    catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  async function transmitirContingencias() {
    if (enviando) return
    setEnviando('contingencias')
    try {
      const r = await api.post(`${BASE}/contingencias/transmitir`, {})
      toast(r.transmissao === 'desligada' ? `Transmissão desligada neste servidor. ${r.pendentes} pendente(s).` : `Contingências: ${r.autorizadas} autorizada(s), ${r.rejeitadas} rejeitada(s), ${r.falhas} sem resposta.`, r.rejeitadas || r.falhas ? 'error' : 'success')
      carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando('') }
  }
  const [periodo, setPeriodo] = useState('todos')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [filtroModelo, setFiltroModelo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  const docsFiltrados = useMemo(() => {
    return docs.filter((d) => {
      if (filtroModelo !== 'todos' && String(d.modelo) !== String(filtroModelo)) return false
      if (filtroStatus !== 'todos' && d.status !== filtroStatus) return false
      if (busca) {
        const termo = busca.toLowerCase()
        const matchNum = String(d.numero || '').includes(termo)
        const matchSerie = String(d.serie || '').includes(termo)
        const matchChave = String(d.chave || '').toLowerCase().includes(termo)
        const matchMsg = (d.mensagens || []).some((m) => (m.mensagem || '').toLowerCase().includes(termo))
        if (!matchNum && !matchSerie && !matchChave && !matchMsg) return false
      }
      if (periodo !== 'todos' && d.criadoEm) {
        const dataDoc = new Date(d.criadoEm)
        const agora = new Date()
        if (periodo === 'hoje') {
          if (dataDoc.toDateString() !== agora.toDateString()) return false
        } else if (periodo === '7d') {
          if (agora - dataDoc > 7 * 864e5) return false
        } else if (periodo === '30d') {
          if (agora - dataDoc > 30 * 864e5) return false
        } else if (periodo === 'mes') {
          if (dataDoc.getMonth() !== agora.getMonth() || dataDoc.getFullYear() !== agora.getFullYear()) return false
        } else if (periodo === 'custom') {
          if (customInicio && dataDoc < new Date(`${customInicio}T00:00:00`)) return false
          if (customFim && dataDoc > new Date(`${customFim}T23:59:59`)) return false
        }
      }
      return true
    })
  }, [docs, filtroModelo, filtroStatus, busca, periodo, customInicio, customFim])

  const kpis = useMemo(() => {
    let totalEmitido = 0
    let autorizados = 0
    let contingenciasCount = 0
    let atrasadasCount = 0
    let falhasCount = 0
    for (const d of docs) {
      if (['autorizado', 'validado_localmente'].includes(d.status)) {
        totalEmitido += Number(d.valorTotal || 0)
        autorizados += 1
      }
      if (d.status === 'contingencia') {
        contingenciasCount += 1
        if (d.contingenciaAtrasada) atrasadasCount += 1
      }
      if (['rejeitado', 'falha_comunicacao'].includes(d.status)) {
        falhasCount += 1
      }
    }
    return { totalEmitido, autorizados, contingenciasCount, atrasadasCount, falhasCount }
  }, [docs])

  const contingencias = docs.filter((d) => d.status === 'contingencia')
  const atrasadas = contingencias.filter((d) => d.contingenciaAtrasada).length
  async function cancelar() {
    try { await api.post(`${BASE}/documentos/${cancelando.doc.id}/cancelar`, { justificativa: cancelando.justificativa }); toast('Documento cancelado.', 'success'); setCancelando(null); carregar() } catch (error) { toast(error.message, 'error') }
  }
  return <div style={{ display: 'grid', gap: 16 }}>
    <section className="dadm-card">
      <h2>Vendas pagas sem nota</h2>
      <Table caption="Vendas sem nota" rows={vendas.map((v) => ({ ...v, id: `${v.origem}:${v.origemId}` }))} empty="Nenhuma venda pendente de nota." columns={[
        { key: 'd', label: 'Venda', render: (v) => <div><strong>{v.descricao}</strong><div className="dadm-muted">{v.origem === 'bar_comanda' ? 'Bar' : v.origem === 'barbearia_comanda' ? 'Barbearia' : 'Loja online'}{v.data ? ` · ${dateTime(v.data)}` : ''}</div></div> },
        { key: 'v', label: 'Valor', align: 'right', render: (v) => (v.valor == null ? '—' : money(v.valor)) },
        { key: 'a', label: '', render: (v) => <div className="dadm-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: '65', origem: v.origem, origemId: v.origemId, ...(contingenciaAuto ? { contingenciaOffline: true } : {}) }, v.id)}>Emitir NFC-e</button>
          {v.origem === 'barbearia_comanda' && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: 'nfse', origem: v.origem, origemId: v.origemId }, `${v.id}:nfse`)}>Emitir NFS-e</button>}
        </div> },
      ]} />
      <label className="dadm-muted"><input type="checkbox" checked={contingenciaAuto} onChange={(e) => setContingenciaAuto(e.target.checked)} /> Se a SEFAZ não responder, emitir a NFC-e em contingência offline (transmitir depois, em até 24 h)</label>
      <div className="dadm-actions">
        <button type="button" className="c360-btn ghost" onClick={() => setNfeAvulsa({ modelo: '65', descricao: '', ncm: '33059000', cfop: '5102', csosn: '102', quantidade: '1', valorUnitario: '', cpf: '', nome: '', chave: chave() })}>+ NFC-e / NF-e avulsa</button>
        <button type="button" className="c360-btn ghost" onClick={() => setNfse({ descricao: '', fonteId: '', valor: '', cpf: '', nome: '', chave: chave() })}>+ NFS-e de serviço</button>
      </div>
    </section>
    {contingencias.length > 0 && <section className="dadm-card">
      <h2>Contingência offline</h2>
      <p className={`dadm-note ${atrasadas ? 'danger' : 'warn'}`}>{contingencias.length} NFC-e em contingência aguardando transmissão{atrasadas ? `; ${atrasadas} passaram do prazo de 24 horas` : ''}.</p>
      <div className="dadm-actions"><button type="button" className="c360-btn primary" disabled={Boolean(enviando)} onClick={transmitirContingencias}>Transmitir contingências</button></div>
    </section>}
    <section className="dadm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2>Documentos emitidos</h2>
          <p className="dadm-muted" style={{ margin: '4px 0 0' }}>Histórico completo de notas fiscais autorizadas, em contingência e validadas.</p>
        </div>
        <button type="button" className="c360-btn ghost" onClick={carregar}>Atualizar lista</button>
      </div>

      <div className="dadm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Total emitido</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: '#14b87a', margin: '4px 0' }}>{money(kpis.totalEmitido)}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.autorizados} nota(s) válida(s)</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Contingência offline</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: kpis.contingenciasCount > 0 ? (kpis.atrasadasCount > 0 ? '#e05c5c' : '#f59e0b') : 'inherit', margin: '4px 0' }}>{kpis.contingenciasCount}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.atrasadasCount > 0 ? `${kpis.atrasadasCount} > 24h vencida(s)` : 'Prazo legal 24h'}</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Vendas sem nota</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>{vendas.length}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>Prontas para emissão</div>
        </div>
        <div className="dadm-kpi" style={{ padding: 14, background: 'var(--surface, rgba(255,255,255,0.03))', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div className="dadm-kpi-sub" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Rejeições / Falhas</div>
          <div className="dadm-kpi-val" style={{ fontSize: 20, fontWeight: 800, color: kpis.falhasCount > 0 ? '#e05c5c' : 'inherit', margin: '4px 0' }}>{kpis.falhasCount}</div>
          <div className="dadm-muted" style={{ fontSize: 12 }}>{kpis.falhasCount > 0 ? 'Exige reenvio' : 'Nenhuma falha'}</div>
        </div>
      </div>

      <div className="dadm-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="search"
          className="c360-input"
          style={{ minWidth: 200, flex: 1 }}
          placeholder="Buscar por número, série, chave, motivo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select className="c360-input" value={filtroModelo} onChange={(e) => setFiltroModelo(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todos os modelos</option>
          <option value="65">NFC-e (Consumidor 65)</option>
          <option value="55">NF-e (Mercadoria 55)</option>
          <option value="nfse">NFS-e (Serviço)</option>
        </select>
        <select className="c360-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="todos">Todas as situações</option>
          <option value="autorizado">Autorizado</option>
          <option value="validado_localmente">Validado localmente</option>
          <option value="contingencia">Contingência</option>
          <option value="falha_comunicacao">Falha comunicação</option>
          <option value="rejeitado">Rejeitado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['todos', 'Todos'], ['hoje', 'Hoje'], ['7d', '7D'], ['30d', '30D'], ['mes', 'Este mês'], ['custom', 'Personalizado']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`c360-btn ${periodo === id ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => {
                setPeriodo(id);
                if (id !== 'custom') {
                  setCustomInicio('');
                  setCustomFim('');
                }
              }}
            >
              {label}
            </button>
          ))}
          {periodo === 'custom' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="c360-input" style={{ width: 'auto', padding: '4px 8px' }} />
              <span className="dadm-muted" style={{ fontSize: 11 }}>a</span>
              <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="c360-input" style={{ width: 'auto', padding: '4px 8px' }} />
            </div>
          )}
        </div>
      </div>

      <Table caption="Documentos fiscais" rows={docsFiltrados} empty="Nenhum documento ainda." columns={[
        { key: 'n', label: 'Documento', render: (d) => <div><strong>{MODELO[d.modelo]} {d.serie}/{d.numero}</strong><div className="dadm-muted">{dateTime(d.criadoEm)}{d.chave ? ` · ${d.chave}` : ''}</div></div> },
        { key: 'v', label: 'Valor', align: 'right', render: (d) => money(d.valorTotal) },
        { key: 's', label: 'Situação', render: (d) => <div><Badge tone={STATUS[d.status]?.[1]}>{STATUS[d.status]?.[0] || d.status}</Badge>{d.contingenciaAtrasada && <> <Badge tone="danger">prazo de 24 h vencido</Badge></>}{d.mensagens?.length > 0 && <div className="dadm-muted">{d.mensagens.map((m) => m.mensagem).join(' · ')}</div>}</div> },
        { key: 'a', label: '', render: (d) => <div className="dadm-actions">
          {d.temXml && <button type="button" className="c360-btn ghost" onClick={() => baixarXml(d)}>XML</button>}
          {d.temXml && d.modelo !== 'nfse' && <button type="button" className="c360-btn ghost" onClick={() => imprimirDanfe(d)}>Imprimir DANFE</button>}
          {d.modelo === '65' && d.status === 'falha_comunicacao' && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emContingencia(d)}>Emitir em contingência</button>}
          {['autorizado', 'validado_localmente'].includes(d.status) && <button type="button" className="c360-btn ghost" onClick={() => setCancelando({ doc: d, justificativa: '' })}>Cancelar</button>}
          {['rejeitado', 'falha_comunicacao', 'enviando'].includes(d.status) && <button type="button" className="c360-btn ghost" disabled={Boolean(enviando)} onClick={() => emitir({ modelo: d.modelo, origem: d.origem, ...(d.origemId ? { origemId: d.origemId } : {}), idempotencia: d.idempotencia }, d.id)}>Tentar de novo</button>}
        </div> },
      ]} />
    </section>
    <Dialog open={Boolean(cancelando)} title="Cancelar documento" labelId="fis-canc" danger onClose={() => setCancelando(null)} onSubmit={cancelar}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setCancelando(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={(cancelando?.justificativa || '').trim().length < 15}>Cancelar documento</button></>}>
      {cancelando && <label className="c360-field">Justificativa (mínimo 15 caracteres)<textarea className="c360-input" rows={3} maxLength={255} value={cancelando.justificativa} onChange={(e) => setCancelando({ ...cancelando, justificativa: e.target.value })} /></label>}
    </Dialog>
    <Dialog open={Boolean(nfse)} title="NFS-e de serviço" labelId="fis-nfse" onClose={() => setNfse(null)}
      onSubmit={() => emitir({ modelo: 'nfse', origem: 'manual', idempotencia: `manual:${nfse.chave}`, itens: [{ fonte: 'servico', fonteId: nfse.fonteId, descricao: nfse.descricao, quantidade: 1, valorUnitario: Number(String(nfse.valor).replace(',', '.')) }], destinatario: nfse.cpf ? { cpf: nfse.cpf, nome: nfse.nome } : null }, 'nfse')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setNfse(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando)}>Emitir NFS-e</button></>}>
      {nfse && <div style={{ display: 'grid', gap: 10 }}>
        <label className="c360-field">Serviço (código cadastrado na Classificação)<input className="c360-input" required value={nfse.fonteId} onChange={(e) => setNfse({ ...nfse, fonteId: e.target.value })} placeholder="ex.: aula-tenis" /></label>
        <label className="c360-field">Descrição na nota<input className="c360-input" required minLength={2} value={nfse.descricao} onChange={(e) => setNfse({ ...nfse, descricao: e.target.value })} /></label>
        <label className="c360-field">Valor (R$)<input className="c360-input" required inputMode="decimal" value={nfse.valor} onChange={(e) => setNfse({ ...nfse, valor: e.target.value })} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <label className="c360-field">CPF do tomador (opcional)<input className="c360-input" inputMode="numeric" value={nfse.cpf} onChange={(e) => setNfse({ ...nfse, cpf: e.target.value })} /></label>
          <label className="c360-field">Nome do tomador<input className="c360-input" value={nfse.nome} onChange={(e) => setNfse({ ...nfse, nome: e.target.value })} /></label>
        </div>
      </div>}
    </Dialog>
    <Dialog open={Boolean(nfeAvulsa)} title="Emitir NFC-e / NF-e avulsa" labelId="fis-nfe-avulsa" onClose={() => setNfeAvulsa(null)}
      onSubmit={() => emitir({
        modelo: nfeAvulsa.modelo,
        origem: 'manual',
        idempotencia: `manual:${nfeAvulsa.chave}`,
        ...(contingenciaAuto && nfeAvulsa.modelo === '65' ? { contingenciaOffline: true } : {}),
        itens: [{
          fonte: 'est_item',
          fonteId: 'avulso-1',
          descricao: nfeAvulsa.descricao,
          quantidade: Number(nfeAvulsa.quantidade) || 1,
          valorUnitario: Number(String(nfeAvulsa.valorUnitario).replace(',', '.')),
          classificacao: { tipo: 'produto', ncm: nfeAvulsa.ncm || '33059000', cfop: nfeAvulsa.cfop || '5102', csosn: nfeAvulsa.csosn || '102', cstIcms: '00', aliquotaIcms: 0 },
        }],
        destinatario: nfeAvulsa.cpf ? { cpf: nfeAvulsa.cpf, nome: nfeAvulsa.nome || 'CONSUMIDOR' } : null,
      }, 'nfe-avulsa')}
      actions={<><button type="button" className="c360-btn ghost" onClick={() => setNfeAvulsa(null)}>Voltar</button><button type="submit" className="c360-btn primary" disabled={Boolean(enviando)}>Emitir {nfeAvulsa?.modelo === '55' ? 'NF-e' : 'NFC-e'}</button></>}>
      {nfeAvulsa && <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <label className="c360-field">Modelo<select className="c360-input" value={nfeAvulsa.modelo} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, modelo: e.target.value })}><option value="65">NFC-e (65 · Consumidor)</option><option value="55">NF-e (55 · Completa)</option></select></label>
          <label className="c360-field">Descrição do produto/item<input className="c360-input" required minLength={2} value={nfeAvulsa.descricao} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, descricao: e.target.value })} placeholder="ex.: Pomada Modeladora Matte" /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label className="c360-field">NCM (8 dígitos)<input className="c360-input" required inputMode="numeric" maxLength={8} value={nfeAvulsa.ncm} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, ncm: e.target.value })} /></label>
          <label className="c360-field">CFOP<input className="c360-input" required inputMode="numeric" maxLength={4} value={nfeAvulsa.cfop} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, cfop: e.target.value })} /></label>
          <label className="c360-field">CSOSN<select className="c360-input" value={nfeAvulsa.csosn} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, csosn: e.target.value })}><option value="102">102 · sem crédito</option><option value="103">103 · isenção</option><option value="300">300 · imune</option><option value="400">400 · não tributada</option></select></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <label className="c360-field">Quantidade<input className="c360-input" required inputMode="numeric" value={nfeAvulsa.quantidade} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, quantidade: e.target.value })} /></label>
          <label className="c360-field">Valor unitário (R$)<input className="c360-input" required inputMode="decimal" value={nfeAvulsa.valorUnitario} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, valorUnitario: e.target.value })} /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <label className="c360-field">CPF/CNPJ do destinatário (opcional na NFC-e)<input className="c360-input" inputMode="numeric" value={nfeAvulsa.cpf} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, cpf: e.target.value })} /></label>
          <label className="c360-field">Nome do destinatário<input className="c360-input" value={nfeAvulsa.nome} onChange={(e) => setNfeAvulsa({ ...nfeAvulsa, nome: e.target.value })} /></label>
        </div>
      </div>}
    </Dialog>
  </div>
}

function Inutilizacao({ toast }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState({ modelo: '65', serie: '1', numeroInicial: '', numeroFinal: '', justificativa: '' })
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(() => api.get(`${BASE}/inutilizacoes`).then((l) => setLista(Array.isArray(l) ? l : [])).catch((e) => toast(e.message, 'error')), [toast])
  useEffect(() => { carregar() }, [carregar])
  const justificativaOk = form.justificativa.trim().length >= 15
  async function enviar(ev) {
    ev.preventDefault()
    if (enviando || !justificativaOk || !form.numeroInicial) return
    setEnviando(true)
    try {
      const r = await api.post(`${BASE}/inutilizacoes`, { modelo: form.modelo, serie: Number(form.serie), numeroInicial: Number(form.numeroInicial), numeroFinal: Number(form.numeroFinal || form.numeroInicial), justificativa: form.justificativa.trim() })
      toast(`Números ${r.numeroInicial} a ${r.numeroFinal}: ${STATUS_INUT[r.status]?.[0] || r.status}.`, r.status === 'rejeitada' ? 'error' : 'success')
      setForm({ ...form, numeroInicial: '', numeroFinal: '', justificativa: '' }); carregar()
    } catch (error) { toast(error.message, 'error') } finally { setEnviando(false) }
  }
  const campo = (rotulo, k, extra = {}) => <label className="c360-field">{rotulo}<input className="c360-input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} /></label>
  return <section className="dadm-card">
    <h2>Inutilização de numeração</h2>
    <p className="dadm-muted">Para números de NF-e ou NFC-e que não serão usados (ex.: o sistema pulou a sequência). Só números ainda sem nota (ou de nota rejeitada). Depois de inutilizados, nunca mais são usados.</p>
    <form onSubmit={enviar} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <label className="c360-field">Modelo<select className="c360-input" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}><option value="65">NFC-e (65)</option><option value="55">NF-e (55)</option></select></label>
        {campo('Série', 'serie', { inputMode: 'numeric', required: true })}
        {campo('Número inicial', 'numeroInicial', { inputMode: 'numeric', required: true })}
        {campo('Número final', 'numeroFinal', { inputMode: 'numeric', placeholder: 'igual ao inicial' })}
      </div>
      <label className="c360-field">Justificativa (mínimo 15 caracteres)<textarea className="c360-input" rows={2} maxLength={255} value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} /></label>
      <div className="dadm-actions"><button type="submit" className="c360-btn primary" disabled={enviando || !justificativaOk || !form.numeroInicial}>Inutilizar números</button></div>
    </form>
    <Table caption="Inutilizações" rows={lista} empty="Nenhuma numeração inutilizada." columns={[
      { key: 'f', label: 'Faixa', render: (i) => <div><strong>{MODELO[i.modelo]} série {i.serie}: {i.numeroInicial === i.numeroFinal ? i.numeroInicial : `${i.numeroInicial} a ${i.numeroFinal}`}</strong><div className="dadm-muted">{dateTime(i.criadoEm)}{i.criadoPor ? ` · ${i.criadoPor}` : ''}</div></div> },
      { key: 'j', label: 'Justificativa', render: (i) => i.justificativa },
      { key: 's', label: 'Situação', render: (i) => <div><Badge tone={STATUS_INUT[i.status]?.[1]}>{STATUS_INUT[i.status]?.[0] || i.status}</Badge>{i.protocolo && <div className="dadm-muted">Protocolo {i.protocolo}</div>}{i.mensagens?.length > 0 && <div className="dadm-muted">{i.mensagens.map((m) => m.mensagem).join(' · ')}</div>}</div> },
    ]} />
  </section>
}

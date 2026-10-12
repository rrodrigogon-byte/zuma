import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

// NFS-e Padrão Nacional: configuração (sem segredos) e ações por comanda.
// O certificado A1 e a senha ficam em variáveis de ambiente do servidor;
// aqui só se informa o NOME dessas variáveis.

const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontSize: 14 }
const rotulo = { display: 'grid', gap: 5, fontSize: 12, color: 'var(--muted)' }
const botao = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--fg)', fontWeight: 700, cursor: 'pointer' }
const primario = { ...botao, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }

export function NfseConfigCard({ onToast }) {
  const [dados, setDados] = useState(null)
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [convenio, setConvenio] = useState(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    try {
      const r = await api.get('/api/admin/barbearia/fiscal/nfse/configuracao')
      setDados(r)
      setForm({ ...r.configuracao, cTribNacPorServico: JSON.stringify(r.configuracao.cTribNacPorServico || {}) })
      setErro('')
    } catch (e) { setErro(e.message) }
  }
  useEffect(() => { carregar() }, [])

  async function salvar(event) {
    event.preventDefault()
    setSalvando(true)
    try {
      let porServico = {}
      try { porServico = form.cTribNacPorServico ? JSON.parse(form.cTribNacPorServico) : {} } catch { throw new Error('Códigos por serviço: use o formato {"id-do-servico":"060101"}.') }
      const { proximoNumero, homologadoEm, atualizadoEm, ...corpo } = form
      const r = await api.put('/api/admin/barbearia/fiscal/nfse/configuracao', { ...corpo, cTribNacPorServico: porServico, pTotTribSN: form.pTotTribSN === '' ? '' : Number(form.pTotTribSN) })
      setDados(r)
      onToast?.('Configuração da NFS-e salva.')
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function verificarConvenio() {
    try { setConvenio(await api.get('/api/admin/barbearia/fiscal/nfse/convenio')) } catch (e) { setConvenio({ erro: e.message }) }
  }

  if (erro && !form) return <div style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 14 }}><strong>NFS-e Nacional</strong><div style={{ color: 'var(--muted)', fontSize: 13 }}>{erro}</div></div>
  if (!form) return null
  const p = dados?.prontidao || {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return <form onSubmit={salvar} style={{ display: 'grid', gap: 14, padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--card)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h3 style={{ margin: 0 }}>NFS-e Nacional</h3><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Emissão direta na Sefin Nacional (sem intermediador). Comece em produção restrita: depois de emitir e cancelar uma nota de teste, a produção é liberada.</p></div>
      <span style={{ alignSelf: 'start', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: p.pronto ? 'color-mix(in srgb, #14b87a 18%, transparent)' : 'color-mix(in srgb, #f59e0b 18%, transparent)', color: p.pronto ? '#14b87a' : '#f59e0b' }}>{p.pronto ? (form.ativo ? `Pronto · ${form.ambiente === 'producao' ? 'produção' : 'produção restrita'}` : 'Pronto · desativado') : 'Configuração pendente'}</span>
    </div>
    {!p.pronto && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Falta: {(p.pendencias || []).join(' · ')}</div>}
    {erro && <div style={{ color: '#e05c5c', fontSize: 13 }}>{erro}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
      <label style={rotulo}>CNPJ do prestador<input style={campo} value={form.cnpj} onChange={set('cnpj')} inputMode="numeric" /></label>
      <label style={rotulo}>Inscrição municipal<input style={campo} value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} /></label>
      <label style={rotulo}>Município (IBGE)<input style={campo} value={form.codigoMunicipio} onChange={set('codigoMunicipio')} inputMode="numeric" /></label>
      <label style={rotulo}>Série da DPS<input style={campo} value={form.serie} onChange={set('serie')} inputMode="numeric" /></label>
      <label style={rotulo}>Regime (Simples)<select style={campo} value={form.opSimpNac} onChange={set('opSimpNac')}><option value="1">Não optante</option><option value="2">MEI</option><option value="3">ME/EPP optante</option></select></label>
      <label style={rotulo}>% aproximado de tributos (Simples)<input style={campo} value={form.pTotTribSN} onChange={set('pTotTribSN')} placeholder="ex.: 6.00 (deixe vazio para não informar)" /></label>
      <label style={rotulo}>Código de tributação nacional padrão (cTribNac)<input style={campo} value={form.cTribNacPadrao} onChange={set('cTribNacPadrao')} placeholder="6 dígitos, conforme o contador" inputMode="numeric" /></label>
      <label style={rotulo}>Ambiente<select style={campo} value={form.ambiente} onChange={set('ambiente')}><option value="producao_restrita">Produção restrita (teste)</option><option value="producao">Produção</option></select></label>
      <label style={rotulo}>Variável com o certificado A1 (base64)<input style={campo} value={form.envPfxBase64} onChange={set('envPfxBase64')} placeholder="NFSE_PFX_B64_DINO" /></label>
      <label style={rotulo}>Variável com a senha do certificado<input style={campo} value={form.envPfxSenha} onChange={set('envPfxSenha')} placeholder="NFSE_PFX_SENHA_DINO" /></label>
    </div>
    <label style={rotulo}>Códigos por serviço (opcional, JSON {'{'}"id-do-servico":"cTribNac"{'}'})<input style={campo} value={form.cTribNacPorServico} onChange={set('cTribNacPorServico')} /></label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="checkbox" checked={form.ativo === true} onChange={set('ativo')} /> Emissão de NFS-e ativa nesta empresa</label>
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Próximo número de DPS: {form.proximoNumero}{form.homologadoEm ? ` · homologado em ${new Date(form.homologadoEm).toLocaleDateString('pt-BR')}` : ' · homologação pendente'}</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="submit" style={primario} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configuração'}</button>
      <button type="button" style={botao} onClick={verificarConvenio} disabled={!p.pronto}>Verificar convênio do município</button>
    </div>
    {convenio && <pre style={{ margin: 0, padding: 10, borderRadius: 10, background: 'var(--bg)', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{convenio.erro || JSON.stringify(convenio.corpo || convenio, null, 2).slice(0, 1500)}</pre>}
  </form>
}

export function NfseComandaAcoes({ documento, onAtualizado, onToast }) {
  const [ocupado, setOcupado] = useState(false)
  const [cpf, setCpf] = useState('')
  const [erros, setErros] = useState([])
  const n = documento?.nfse || null

  async function emitir() {
    if (!window.confirm(`Emitir NFS-e deste atendimento${cpf ? ` para o CPF ${cpf}` : ' sem identificar o tomador'}?`)) return
    setOcupado(true); setErros([])
    try {
      const r = await api.post(`/api/admin/barbearia/fiscal/documentos/${documento.id}/nfse`, { confirmado: true, tomador: cpf ? { cpf } : null })
      onToast?.('NFS-e autorizada.')
      onAtualizado?.(r.documento)
    } catch (e) {
      setErros([{ codigo: e.code || '', descricao: e.message }])
      onAtualizado?.()
    } finally { setOcupado(false) }
  }

  async function cancelar() {
    const motivo = window.prompt('Motivo do cancelamento (mínimo 15 caracteres):', 'Erro na emissão da nota fiscal')
    if (!motivo) return
    setOcupado(true); setErros([])
    try {
      const r = await api.post(`/api/admin/barbearia/fiscal/documentos/${documento.id}/nfse/cancelamento`, { confirmado: true, cMotivo: 1, xMotivo: motivo })
      onToast?.('NFS-e cancelada.')
      onAtualizado?.(r.documento)
    } catch (e) { setErros([{ codigo: e.code || '', descricao: e.message }]) } finally { setOcupado(false) }
  }

  async function baixar(tipo) {
    let emp = ''; try { emp = JSON.parse(localStorage.getItem('sp_empresa_ativa') || 'null')?.id || '' } catch { emp = '' }
    let loja = ''; try { loja = JSON.parse(localStorage.getItem('sp_loja_ativa') || 'null')?.id || '' } catch { loja = '' }
    // A janela é aberta já no clique para não ser bloqueada como pop-up.
    const janela = tipo === 'danfse' ? window.open('', '_blank') : null
    setErros([])
    try {
      const r = await fetch(`/api/admin/barbearia/fiscal/documentos/${documento.id}/nfse/${tipo}`, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('sp_token') || ''), ...(emp ? { 'X-Empresa-Id': emp } : {}), ...(loja ? { 'X-Loja-Id': loja } : {}) } })
      if (!r.ok) { let msg = tipo === 'danfse' ? 'Não foi possível gerar o DANFSe.' : 'Não foi possível baixar o XML.'; try { msg = (await r.json()).error || msg } catch { /* corpo não-JSON */ } throw new Error(msg) }
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      if (janela) { janela.location.href = u; setTimeout(() => URL.revokeObjectURL(u), 60000); return }
      const a = document.createElement('a'); a.href = u; a.download = `nfse-${n?.numero || documento.id}.xml`; a.click(); URL.revokeObjectURL(u)
    } catch (e) { janela?.close(); setErros([{ descricao: e.message }]) }
  }

  async function sincronizar() {
    setOcupado(true); setErros([])
    try {
      const r = await api.post(`/api/admin/barbearia/fiscal/documentos/${documento.id}/nfse/sincronizar`, {})
      onToast?.(r.xmlObtido ? 'XML da NFS-e obtido da Sefin.' : 'Sefin consultada; o XML ainda não está disponível.')
      onAtualizado?.(r.documento)
    } catch (e) { setErros([{ codigo: e.code || '', descricao: e.message }]) } finally { setOcupado(false) }
  }

  if (!documento) return null
  const errosMostrar = erros.length ? erros : (n?.status === 'rejeitada' ? (n.erros || []) : [])
  return <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
    {n?.status === 'autorizada' && <div style={{ fontSize: 13 }}><strong style={{ color: '#14b87a' }}>NFS-e autorizada</strong> · nº {n.numero} · chave {n.chaveAcesso}{n.ambiente === 'producao_restrita' ? ' · produção restrita (teste)' : ''}</div>}
    {n?.status === 'cancelada' && <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>NFS-e cancelada · chave {n.chaveAcesso}{n.xmlDisponivel && <button type="button" style={botao} disabled={ocupado} onClick={() => baixar('danfse')}>DANFSe (cancelada)</button>}</div>}
    {errosMostrar.length > 0 && <div style={{ fontSize: 12, color: '#e05c5c' }}>{errosMostrar.map((e, i) => <div key={i}>{e.codigo ? `${e.codigo}: ` : ''}{e.descricao}</div>)}</div>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {(!n || ['rejeitada', 'falha_comunicacao', 'enviando'].includes(n.status)) && <>
        <input style={{ ...campo, width: 170 }} placeholder="CPF do cliente (opcional)" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" />
        <button type="button" style={primario} disabled={ocupado} onClick={emitir}>{ocupado ? 'Enviando…' : (n ? 'Tentar emitir de novo' : 'Emitir NFS-e')}</button>
      </>}
      {n?.status === 'autorizada' && <>
        {n.xmlDisponivel && <button type="button" style={botao} disabled={ocupado} onClick={() => baixar('danfse')}>Imprimir DANFSe</button>}
        {n.xmlDisponivel && <button type="button" style={botao} disabled={ocupado} onClick={() => baixar('xml')}>Baixar XML</button>}
        {!n.xmlDisponivel && <button type="button" style={botao} disabled={ocupado} onClick={sincronizar}>Atualizar da Sefin</button>}
        <button type="button" style={{ ...botao, color: '#e05c5c' }} disabled={ocupado} onClick={cancelar}>Cancelar NFS-e</button>
      </>}
    </div>
  </div>
}

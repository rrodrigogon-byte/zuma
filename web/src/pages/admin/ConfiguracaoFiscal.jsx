import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

const EMPTY_CONFIG = {
  cnpj: '', ie: '', im: '', cnae: '', crt: '1', razaoSocial: '', nomeFantasia: '', uf: 'MT',
  regimeTributario: 'simples', ambiente: 'homologacao', cscId: '', csc: '',
  serieNfce: 1, serieNfe: 1, naturezaOperacaoNfce: 'VENDA DE MERCADORIA', naturezaOperacaoNfe: 'VENDA DE MERCADORIA',
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', codigoMunicipio: '', cep: '' },
}

const fieldStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontSize: 13,
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return <div>
    <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 700 }}>
      {label}{required ? ' *' : ''}
    </label>
    <input type={type} placeholder={placeholder} value={value ?? ''} onChange={onChange} style={fieldStyle} />
  </div>
}

function Section({ title, description, children }) {
  return <section style={{ background: 'var(--card)', borderRadius: 14, padding: 24, border: '1px solid var(--line)', marginBottom: 20 }}>
    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
    {description && <p style={{ margin: '6px 0 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{description}</p>}
    {children}
  </section>
}

export default function ConfiguracaoFiscal() {
  const { toast } = useToast()
  const [config, setConfig] = useState(null)
  const [certificados, setCertificados] = useState([])
  const [form, setForm] = useState(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [certFile, setCertFile] = useState(null)
  const [certSenha, setCertSenha] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [result, certsResult] = await Promise.all([
        api.get('/api/v1/fiscal/config'),
        api.get('/api/v1/fiscal/certificados'),
      ])
      const loaded = result.config || EMPTY_CONFIG
      setConfig(loaded)
      setCertificados(certsResult.certificados || [])
      setForm({ ...EMPTY_CONFIG, ...loaded, endereco: { ...EMPTY_CONFIG.endereco, ...(loaded.endereco || {}) } })
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a configuração fiscal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const updateAddress = (key, value) => setForm(current => ({ ...current, endereco: { ...current.endereco, [key]: value } }))

  async function salvarConfig() {
    setSaving(true)
    try {
      const result = await api.post('/api/v1/fiscal/config', form)
      const loaded = result.config || form
      setConfig(loaded)
      setForm(current => ({ ...current, ...loaded, endereco: { ...current.endereco, ...(loaded.endereco || {}) } }))
      toast('Configuração fiscal salva com sucesso.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a configuração.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadCertificado() {
    if (!certFile || !certSenha) {
      toast('Selecione o certificado A1 e informe a senha.', 'error')
      return
    }
    setUploading(true)
    try {
      const bytes = await certFile.arrayBuffer()
      const binary = new Uint8Array(bytes)
      let text = ''
      const block = 0x8000
      for (let i = 0; i < binary.length; i += block) text += String.fromCharCode(...binary.subarray(i, i + block))
      const result = await api.post('/api/v1/fiscal/certificado', {
        pfx_base64: btoa(text), senha: certSenha, nomeArquivo: certFile.name,
      })
      const loaded = result.config || EMPTY_CONFIG
      setConfig(loaded)
      setForm(current => ({ ...current, ...loaded, endereco: { ...current.endereco, ...(loaded.endereco || {}) } }))
      setCertificados(await api.get('/api/v1/fiscal/certificados').then(data => data.certificados || []))
      setCertFile(null)
      setCertSenha('')
      toast('Certificado A1 validado e armazenado de forma cifrada.', 'success')
    } catch (error) {
      toast(error.message || 'Falha ao importar o certificado.', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function ativarCertificado(certificadoId) {
    try {
      const result = await api.post(`/api/v1/fiscal/certificados/${certificadoId}/ativar`, {})
      const loaded = result.config || EMPTY_CONFIG
      setConfig(loaded)
      setForm(current => ({ ...current, ...loaded, endereco: { ...current.endereco, ...(loaded.endereco || {}) } }))
      setCertificados(await api.get('/api/v1/fiscal/certificados').then(data => data.certificados || []))
      toast('Certificado ativo atualizado.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível ativar o certificado.', 'error')
    }
  }

  const preflight = config?.preflight || { pronto: false, pendencias: ['Carregando validações fiscais.'] }
  const certificate = config?.certificado

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Carregando configuração fiscal…</div>

  return <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11, fontWeight: 800 }}>Fiscal e conformidade</p>
      <h1 style={{ margin: '5px 0 6px', fontSize: 27, fontWeight: 850 }}>Configuração de NF-e e NFC-e</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>Importe certificados A1, mantenha o cadastro do emitente e acompanhe os requisitos antes de autorizar qualquer documento fiscal.</p>
    </header>

    <div style={{ background: preflight.pronto ? 'rgba(255,107,44,.10)' : 'rgba(224,92,92,.10)', border: `1px solid ${preflight.pronto ? 'rgba(255,107,44,.45)' : 'rgba(224,92,92,.45)'}`, borderRadius: 14, padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 24 }}>{preflight.pronto ? '✓' : '!'}</span>
      <div style={{ flex: 1 }}>
        <strong style={{ color: preflight.pronto ? 'var(--accent)' : '#c0392b' }}>{preflight.pronto ? 'Cadastro pronto para a etapa de autorização' : 'Emissão protegida por validação cadastral'}</strong>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{preflight.pronto ? `Ambiente selecionado: ${preflight.ambiente === 'producao' ? 'Produção' : 'Homologação'}.` : 'Complete os itens abaixo antes de liberar a autorização fiscal.'}</p>
        {!preflight.pronto && <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--fg)', fontSize: 13, lineHeight: 1.7 }}>{preflight.pendencias.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
    </div>

    <Section title="🔐 Certificado Digital A1" description="O arquivo é validado no envio, cifrado em objeto privado do Cloud Storage e associado a esta empresa. A senha não é retornada ao navegador nem fica gravada em texto claro.">
      {certificate ? <div style={{ background: 'rgba(255,107,44,.08)', border: '1px solid rgba(255,107,44,.28)', borderRadius: 10, padding: 14, marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, fontSize: 13 }}>
        <div><span style={{ color: 'var(--muted)' }}>Situação</span><br /><strong style={{ color: 'var(--accent)' }}>A1 válido e ativo</strong></div>
        <div><span style={{ color: 'var(--muted)' }}>Titular</span><br /><strong>{certificate.commonName || '—'}</strong></div>
        <div><span style={{ color: 'var(--muted)' }}>Validade</span><br /><strong>{certificate.validTo ? new Date(certificate.validTo).toLocaleDateString('pt-BR') : '—'}</strong></div>
        <div><span style={{ color: 'var(--muted)' }}>Arquivo</span><br /><strong>{certificate.nomeArquivo}</strong></div>
      </div> : <p style={{ padding: 12, borderRadius: 8, background: 'rgba(224,92,92,.08)', color: '#c0392b', fontSize: 13 }}>Nenhum certificado A1 ativo para esta empresa.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(180px,1fr) auto', gap: 14, alignItems: 'end' }}>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 700 }}>Arquivo .p12 ou .pfx</label><input type="file" accept=".p12,.pfx" onChange={event => setCertFile(event.target.files?.[0] || null)} style={fieldStyle} /></div>
        <Field label="Senha do certificado" type="password" value={certSenha} onChange={event => setCertSenha(event.target.value)} placeholder="Senha do A1" />
        <button type="button" onClick={uploadCertificado} disabled={uploading} className="btn-primary" style={{ minHeight: 39, whiteSpace: 'nowrap' }}>{uploading ? 'Validando…' : 'Importar A1'}</button>
      </div>
      {certificados.length > 0 && <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 8 }}>Certificados importados</div>
        {certificados.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
          <span style={{ color: item.id === certificate?.id ? 'var(--accent)' : 'var(--muted)' }}>{item.id === certificate?.id ? '●' : '○'}</span>
          <div style={{ flex: 1, minWidth: 0 }}><strong>{item.commonName || item.nomeArquivo}</strong><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>Válido até {item.validTo ? new Date(item.validTo).toLocaleDateString('pt-BR') : '—'}</span></div>
          {item.id !== certificate?.id && <button type="button" onClick={() => ativarCertificado(item.id)} className="btn-ghost btn-sm">Tornar ativo</button>}
          {item.id === certificate?.id && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>ATIVO</span>}
        </div>)}
      </div>}
    </Section>

    <Section title="🏢 Identificação do emitente" description="Os dados abaixo são utilizados na montagem e nas validações da NF-e/NFC-e.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
        <Field label="CNPJ" required value={form.cnpj} onChange={e => update('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
        <Field label="Inscrição Estadual" required value={form.ie} onChange={e => update('ie', e.target.value)} placeholder="Inscrição estadual" />
        <Field label="Inscrição Municipal" value={form.im} onChange={e => update('im', e.target.value)} placeholder="Inscrição municipal" />
        <Field label="CNAE principal" value={form.cnae} onChange={e => update('cnae', e.target.value)} placeholder="Ex.: 5611201" />
        <Field label="UF" required value={form.uf} onChange={e => update('uf', e.target.value.toUpperCase())} placeholder="MT" />
        <Field label="Razão social" required value={form.razaoSocial} onChange={e => update('razaoSocial', e.target.value)} placeholder="Razão social do emitente" />
        <Field label="Nome fantasia" value={form.nomeFantasia} onChange={e => update('nomeFantasia', e.target.value)} placeholder="Nome de exibição" />
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 700 }}>Regime tributário</label><select value={form.regimeTributario} onChange={e => update('regimeTributario', e.target.value)} style={fieldStyle}><option value="simples">Simples Nacional (CRT 1)</option><option value="lucro_presumido">Lucro Presumido (CRT 3)</option><option value="lucro_real">Lucro Real (CRT 3)</option></select></div>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 700 }}>CRT</label><select value={form.crt} onChange={e => update('crt', e.target.value)} style={fieldStyle}><option value="1">1 — Simples Nacional</option><option value="2">2 — Simples Nacional (excesso sublimite)</option><option value="3">3 — Regime Normal</option></select></div>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 700 }}>Ambiente SEFAZ</label><select value={form.ambiente} onChange={e => update('ambiente', e.target.value)} style={fieldStyle}><option value="homologacao">Homologação — testes</option><option value="producao">Produção — documentos válidos</option></select></div>
      </div>
    </Section>

    <Section title="📍 Endereço fiscal" description="Informe o endereço cadastrado para o CNPJ e o código IBGE do município.">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
        <Field label="Logradouro" required value={form.endereco.logradouro} onChange={e => updateAddress('logradouro', e.target.value)} placeholder="Rua, avenida ou rodovia" />
        <Field label="Número" required value={form.endereco.numero} onChange={e => updateAddress('numero', e.target.value)} placeholder="Número" />
        <Field label="Complemento" value={form.endereco.complemento} onChange={e => updateAddress('complemento', e.target.value)} placeholder="Complemento" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 14 }}>
        <Field label="Bairro" required value={form.endereco.bairro} onChange={e => updateAddress('bairro', e.target.value)} placeholder="Bairro" />
        <Field label="Cidade" required value={form.endereco.cidade} onChange={e => updateAddress('cidade', e.target.value)} placeholder="Cidade" />
        <Field label="Código IBGE" required value={form.endereco.codigoMunicipio} onChange={e => updateAddress('codigoMunicipio', e.target.value)} placeholder="Ex.: 5107958" />
        <Field label="CEP" required value={form.endereco.cep} onChange={e => updateAddress('cep', e.target.value)} placeholder="00000-000" />
      </div>
    </Section>

    <Section title="🧾 Numeração e segurança da NFC-e" description="Em produção, CSC ID e CSC são exigidos para autorizações de NFC-e. Não reutilize números já autorizados em outro emissor.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
        <Field label="CSC ID" value={form.cscId} onChange={e => update('cscId', e.target.value)} placeholder="Ex.: 000001" />
        <Field label="CSC" type="password" value={form.csc} onChange={e => update('csc', e.target.value)} placeholder={config?.cscConfigurado ? 'CSC já configurado — deixe em branco para manter' : 'Token CSC da SEFAZ'} />
        <Field label="Série NFC-e" type="number" value={form.serieNfce} onChange={e => update('serieNfce', e.target.value)} placeholder="1" />
        <Field label="Série NF-e" type="number" value={form.serieNfe} onChange={e => update('serieNfe', e.target.value)} placeholder="1" />
        <Field label="Natureza da operação NFC-e" value={form.naturezaOperacaoNfce} onChange={e => update('naturezaOperacaoNfce', e.target.value)} placeholder="VENDA DE MERCADORIA" />
        <Field label="Natureza da operação NF-e" value={form.naturezaOperacaoNfe} onChange={e => update('naturezaOperacaoNfe', e.target.value)} placeholder="VENDA DE MERCADORIA" />
      </div>
    </Section>

    <button type="button" onClick={salvarConfig} disabled={saving} className="btn-primary" style={{ width: '100%', minHeight: 46, fontSize: 15 }}>{saving ? 'Salvando configuração…' : 'Salvar configuração fiscal'}</button>
  </div>
}
